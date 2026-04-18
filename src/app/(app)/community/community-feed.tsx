"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPost, likePost, createComment } from "@/lib/community/actions";

type PostWithAuthor = {
  id: string; content: string; likes_count: number; created_at: string;
  user_id: string; cohort_id: string | null;
  profiles: { display_name: string | null } | null;
};

type CommentWithAuthor = {
  id: string; post_id: string; content: string; created_at: string;
  user_id: string; profiles: { display_name: string | null } | null;
};

export function CommunityFeed({
  userId, orgId, cohortId, cohortName, cohortPosts, alumniPosts, commentsByPost, likedPostIds,
}: {
  userId: string;
  orgId: string | null;
  cohortId: string | null;
  cohortName: string | null;
  cohortPosts: PostWithAuthor[];
  alumniPosts: PostWithAuthor[];
  commentsByPost: Record<string, CommentWithAuthor[]>;
  likedPostIds: Set<string>;
}) {
  const [tab, setTab] = useState<"cohort" | "alumni">(cohortId ? "cohort" : "alumni");
  const [newPost, setNewPost] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  const posts = tab === "cohort" ? cohortPosts : alumniPosts;

  const handlePost = () => {
    if (!newPost.trim()) return;
    start(async () => {
      await createPost(newPost, tab === "cohort" ? cohortId : null);
      setNewPost("");
      router.refresh();
    });
  };

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-4 rounded-lg bg-white p-1 border border-neutral-200 shadow-sm">
        {cohortId && (
          <TabButton active={tab === "cohort"} onClick={() => setTab("cohort")}>
            My Cohort{cohortName ? ` — ${cohortName}` : ""}
          </TabButton>
        )}
        <TabButton active={tab === "alumni"} onClick={() => setTab("alumni")}>
          Alumni Network
        </TabButton>
      </div>

      {/* New post */}
      <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm mb-6">
        <textarea
          value={newPost}
          onChange={(e) => setNewPost(e.target.value)}
          placeholder={tab === "cohort"
            ? "Share something with your cohort — a win, a struggle, a question..."
            : "Share with the alumni network — insights, advice, updates..."
          }
          rows={3}
          className="w-full resize-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-neutral-500">
            Posting to: {tab === "cohort" ? `${cohortName ?? "your cohort"}` : "alumni network (org-wide)"}
          </span>
          <button
            onClick={handlePost}
            disabled={pending || !newPost.trim()}
            className="rounded-md bg-brand-blue px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-50"
          >
            Post
          </button>
        </div>
      </div>

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
          {tab === "cohort"
            ? "No posts in your cohort yet. Be the first to share something."
            : "No alumni posts yet. Start the conversation."}
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              comments={commentsByPost[post.id] ?? []}
              isLiked={likedPostIds.has(post.id)}
              isOwn={post.user_id === userId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PostCard({ post, comments, isLiked, isOwn }: {
  post: PostWithAuthor;
  comments: CommentWithAuthor[];
  isLiked: boolean;
  isOwn: boolean;
}) {
  const [showComments, setShowComments] = useState(comments.length > 0);
  const [commentText, setCommentText] = useState("");
  const [liked, setLiked] = useState(isLiked);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [pending, start] = useTransition();
  const router = useRouter();

  const handleLike = () => {
    setLiked(!liked);
    setLikesCount((c) => liked ? c - 1 : c + 1);
    start(async () => {
      await likePost(post.id);
      router.refresh();
    });
  };

  const handleComment = () => {
    if (!commentText.trim()) return;
    start(async () => {
      await createComment(post.id, commentText);
      setCommentText("");
      router.refresh();
    });
  };

  const authorName = post.profiles?.display_name ?? "Anonymous";

  return (
    <div className="rounded-lg border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div className="p-4">
        {/* Author + time */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-navy text-xs font-bold text-white">
            {authorName.charAt(0).toUpperCase()}
          </div>
          <div>
            <span className="text-sm font-medium text-brand-navy">{authorName}</span>
            {isOwn && <span className="ml-1 text-xs text-neutral-400">(you)</span>}
            <span className="ml-2 text-xs text-neutral-400">{timeAgo(post.created_at)}</span>
          </div>
        </div>

        {/* Content */}
        <p className="text-sm text-neutral-800 whitespace-pre-wrap">{post.content}</p>

        {/* Actions */}
        <div className="mt-3 flex items-center gap-4 text-xs">
          <button onClick={handleLike} disabled={pending} className={`flex items-center gap-1 transition ${liked ? "text-brand-pink font-medium" : "text-neutral-500 hover:text-brand-pink"}`}>
            {liked ? "♥" : "♡"} {likesCount > 0 ? likesCount : ""}
          </button>
          <button onClick={() => setShowComments(!showComments)} className="text-neutral-500 hover:text-brand-blue transition">
            💬 {comments.length > 0 ? comments.length : "Comment"}
          </button>
        </div>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-3">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2 mb-2 last:mb-0">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-navy/10 text-[10px] font-bold text-brand-navy shrink-0 mt-0.5">
                {(c.profiles?.display_name ?? "?").charAt(0).toUpperCase()}
              </div>
              <div>
                <span className="text-xs font-medium text-brand-navy">{c.profiles?.display_name ?? "Anonymous"}</span>
                <span className="ml-1 text-[10px] text-neutral-400">{timeAgo(c.created_at)}</span>
                <p className="text-xs text-neutral-700">{c.content}</p>
              </div>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
              onKeyDown={(e) => { if (e.key === "Enter") handleComment(); }}
            />
            <button onClick={handleComment} disabled={pending || !commentText.trim()} className="rounded-md bg-brand-blue px-2 py-1 text-xs text-white hover:bg-brand-blue-dark disabled:opacity-50">
              Reply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
        active ? "bg-brand-blue text-white shadow-sm" : "text-neutral-600 hover:bg-brand-light"
      }`}
    >
      {children}
    </button>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
