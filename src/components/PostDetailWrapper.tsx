import { useState, useEffect } from 'react';
import PostDetail from './PostDetail';

export default function PostDetailWrapper() {
  const [postId, setPostId] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
      setPostId(Number(id));
    } else {
      window.location.replace('/home');
    }
  }, []);

  if (!postId) {
    return (
      <div className="text-center py-12">
        <p className="font-['Share_Tech_Mono'] text-text-muted text-sm animate-pulse">LOADING...</p>
      </div>
    );
  }

  return <PostDetail postId={postId} />;
}
