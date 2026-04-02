import { supabase } from './supabase';

// ===== Types =====

export interface Wallet {
  balance: number;
  total_earned: number;
  total_spent: number;
}

export interface CoinTransaction {
  id: number;
  amount: number;
  balance_after: number;
  tx_type: string;
  description: string | null;
  created_at: string;
}

export interface GameTicket {
  id: number;
  plays: number;
  original: number;
  expires_at: string;
}

export type LotteryPrize = 'jackpot' | 'hit' | 'small_hit' | 'lucky' | 'consolation';

export interface LotteryResult {
  prize_tier: LotteryPrize;
  reward_type: 'ticket' | 'coin';
  reward_value: number;
}

// ===== Wallet =====

export async function getWallet(): Promise<Wallet | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('wallets')
    .select('balance, total_earned, total_spent')
    .eq('user_id', user.id)
    .maybeSingle();

  return data;
}

export async function getTransactions(limit = 20): Promise<CoinTransaction[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('coin_transactions')
    .select('id, amount, balance_after, tx_type, description, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as CoinTransaction[];
}

// ===== Core: Spend & Earn =====

async function modifyBalance(
  amount: number,
  txType: string,
  description: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'not authenticated' };

  // Get current full wallet
  const { data: wallet, error: fetchErr } = await supabase
    .from('wallets')
    .select('balance, total_earned, total_spent')
    .eq('user_id', user.id)
    .single();

  if (fetchErr || !wallet) return { success: false, error: fetchErr?.message ?? 'wallet not found' };

  const newBalance = wallet.balance + amount;
  if (newBalance < 0) return { success: false, error: 'insufficient balance' };

  const earned = amount > 0 ? amount : 0;
  const spent = amount < 0 ? Math.abs(amount) : 0;

  // Update wallet
  const { error: walletErr } = await supabase
    .from('wallets')
    .update({
      balance: newBalance,
      total_earned: wallet.total_earned + earned,
      total_spent: wallet.total_spent + spent,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id);

  if (walletErr) return { success: false, error: walletErr.message };

  // Record transaction
  const { error: txErr } = await supabase.from('coin_transactions').insert({
    user_id: user.id,
    amount,
    balance_after: newBalance,
    tx_type: txType,
    description,
  });

  if (txErr) return { success: false, error: txErr.message };

  return { success: true, newBalance };
}

export async function spendCoins(
  cost: number,
  txType: string,
  description: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  return modifyBalance(-cost, txType, description);
}

export async function earnCoins(
  amount: number,
  txType: string,
  description: string
): Promise<{ success: boolean; newBalance?: number }> {
  return modifyBalance(amount, txType, description);
}

// ===== Game Tickets =====

export async function getActiveTickets(): Promise<GameTicket[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('game_tickets')
    .select('id, plays, original, expires_at')
    .eq('user_id', user.id)
    .gt('plays', 0)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true });

  return (data ?? []) as GameTicket[];
}

export async function useTicket(): Promise<{ success: boolean; error?: string }> {
  const tickets = await getActiveTickets();
  if (tickets.length === 0) return { success: false, error: 'no tickets' };

  const ticket = tickets[0];
  const newPlays = ticket.plays - 1;

  if (newPlays <= 0) {
    await supabase.from('game_tickets').delete().eq('id', ticket.id);
  } else {
    await supabase.from('game_tickets').update({ plays: newPlays }).eq('id', ticket.id);
  }

  return { success: true };
}

// ===== Daily Actions =====

async function getDailyCounter() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from('daily_action_counters')
    .select('*')
    .eq('user_id', user.id)
    .eq('action_date', today)
    .maybeSingle();

  if (data) return data;

  // Create today's counter
  const { data: created } = await supabase
    .from('daily_action_counters')
    .insert({ user_id: user.id, action_date: today })
    .select()
    .single();

  return created;
}

export async function claimLoginBonus(): Promise<{ claimed: boolean; amount?: number }> {
  const counter = await getDailyCounter();
  if (!counter || counter.login_claimed) return { claimed: false };

  await supabase
    .from('daily_action_counters')
    .update({ login_claimed: true })
    .eq('user_id', counter.user_id)
    .eq('action_date', counter.action_date);

  const result = await earnCoins(100, 'daily_login', 'デイリーログインボーナス ¥100');
  return { claimed: true, amount: 100 };
}

export async function earnResonanceReward(): Promise<{ earned: boolean; amount?: number }> {
  const counter = await getDailyCounter();
  if (!counter || counter.resonances >= 30) return { earned: false };

  await supabase
    .from('daily_action_counters')
    .update({ resonances: counter.resonances + 1 })
    .eq('user_id', counter.user_id)
    .eq('action_date', counter.action_date);

  await earnCoins(10, 'resonance_given', '共鳴ボーナス ¥10');
  return { earned: true, amount: 10 };
}

export async function earnCommentReward(): Promise<{ earned: boolean; amount?: number }> {
  const counter = await getDailyCounter();
  if (!counter || counter.comments >= 15) return { earned: false };

  await supabase
    .from('daily_action_counters')
    .update({ comments: counter.comments + 1 })
    .eq('user_id', counter.user_id)
    .eq('action_date', counter.action_date);

  await earnCoins(20, 'comment_given', 'コメントボーナス ¥20');
  return { earned: true, amount: 20 };
}

// ===== Lottery =====

export async function canDrawLottery(): Promise<boolean> {
  const counter = await getDailyCounter();
  return counter ? !counter.lottery_drawn : false;
}

export async function drawLottery(): Promise<LotteryResult | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const counter = await getDailyCounter();
  if (!counter || counter.lottery_drawn) return null;

  // Mark as drawn
  await supabase
    .from('daily_action_counters')
    .update({ lottery_drawn: true })
    .eq('user_id', counter.user_id)
    .eq('action_date', counter.action_date);

  // Roll
  const roll = Math.random() * 100;
  let prize: LotteryPrize;
  let rewardType: 'ticket' | 'coin';
  let rewardValue: number;

  if (roll < 1) {
    prize = 'jackpot'; rewardType = 'ticket'; rewardValue = 10;
  } else if (roll < 6) {
    prize = 'hit'; rewardType = 'ticket'; rewardValue = 5;
  } else if (roll < 20) {
    prize = 'small_hit'; rewardType = 'ticket'; rewardValue = 3;
  } else if (roll < 50) {
    prize = 'lucky'; rewardType = 'coin'; rewardValue = 100;
  } else {
    prize = 'consolation'; rewardType = 'coin'; rewardValue = 30;
  }

  // Record draw
  await supabase.from('lottery_draws').insert({
    user_id: user.id,
    prize_tier: prize,
    reward_type: rewardType,
    reward_value: rewardValue,
  });

  // Grant reward
  if (rewardType === 'ticket') {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await supabase.from('game_tickets').insert({
      user_id: user.id,
      plays: rewardValue,
      original: rewardValue,
      expires_at: expiresAt.toISOString(),
    });
  } else {
    await earnCoins(rewardValue, 'lottery', `くじ引き: ¥${rewardValue}`);
  }

  return { prize_tier: prize, reward_type: rewardType, reward_value: rewardValue };
}

// ===== Play Cost =====

export async function canPlay(): Promise<{ canPlay: boolean; method: 'coin' | 'ticket' | 'none'; cost: number }> {
  const tickets = await getActiveTickets();
  if (tickets.length > 0) return { canPlay: true, method: 'ticket', cost: 0 };

  const wallet = await getWallet();
  if (wallet && wallet.balance >= 50) return { canPlay: true, method: 'coin', cost: 50 };

  return { canPlay: false, method: 'none', cost: 50 };
}

export async function payForPlay(): Promise<{ success: boolean; method?: string; error?: string }> {
  // Try ticket first
  const tickets = await getActiveTickets();
  if (tickets.length > 0) {
    const result = await useTicket();
    if (result.success) return { success: true, method: 'ticket' };
  }

  // Then coins
  const result = await spendCoins(50, 'play', 'ゲームプレイ ¥50');
  if (result.success) return { success: true, method: 'coin' };

  return { success: false, error: result.error ?? 'お小遣いが足りません' };
}
