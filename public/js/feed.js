/* =========================================================
   PULSE SOCIAL — FEED
   No-duplicate feed + pagination + following priority
========================================================= */

const FEED_LIMIT = 10;

let feedOffset = 0;
let loadingFeed = false;
let hasMorePosts = true;
let currentFeedMode = "for-you";

const seenPostIds = new Set();

document.addEventListener("DOMContentLoaded", async () => {
  setupFeedControls();
  await loadFeed(true);
});

/* =========================================================
   FEED CONTROLS
========================================================= */

function setupFeedControls() {
  const refreshButton = document.getElementById("refreshFeed");

  if (refreshButton) {
    refreshButton.addEventListener("click", async () => {
      await loadFeed(true);
    });
  }

  const forYouButton = document.getElementById("forYouFeed");
  const followingButton = document.getElementById("followingFeed");

  if (forYouButton) {
    forYouButton.addEventListener("click", async () => {
      currentFeedMode = "for-you";

      forYouButton.classList.add("active");

      if (followingButton) {
        followingButton.classList.remove("active");
      }

      await loadFeed(true);
    });
  }

  if (followingButton) {
    followingButton.addEventListener("click", async () => {
      currentFeedMode = "following";

      followingButton.classList.add("active");

      if (forYouButton) {
        forYouButton.classList.remove("active");
      }

      await loadFeed(true);
    });
  }

  const loadMoreButton = document.getElementById("loadMorePosts");

  if (loadMoreButton) {
    loadMoreButton.addEventListener("click", async () => {
      await loadFeed(false);
    });
  }

  /*
    Infinite scroll.
    The button still works if the user prefers manual loading.
  */
  window.addEventListener("scroll", () => {
    if (loadingFeed || !hasMorePosts) return;

    const scrollPosition =
      window.innerHeight + window.scrollY;

    const pageHeight =
      document.documentElement.scrollHeight;

    if (scrollPosition >= pageHeight - 700) {
      loadFeed(false);
    }
  });
}

/* =========================================================
   LOAD FEED
========================================================= */

async function loadFeed(reset = false) {
  if (loadingFeed) return;

  if (!reset && !hasMorePosts) return;

  loadingFeed = true;

  const feedContainer = getFeedContainer();
  const loadMoreButton = document.getElementById("loadMorePosts");

  if (reset) {
    feedOffset = 0;
    hasMorePosts = true;
    seenPostIds.clear();

    if (feedContainer) {
      feedContainer.innerHTML = `
        <div class="feed-loading">
          Loading posts...
        </div>
      `;
    }
  }

  try {
    const params = new URLSearchParams();

    params.set("limit", String(FEED_LIMIT));
    params.set("offset", String(feedOffset));

    if (currentFeedMode === "following") {
      params.set("following", "true");
    }

    /*
      Tell the server which posts this browser has already
      received. This gives the server another layer of
      duplicate protection.
    */
    if (seenPostIds.size > 0) {
      params.set(
        "exclude",
        Array.from(seenPostIds).join(",")
      );
    }

    const response = await fetch(
      `/api/feed?${params.toString()}`,
      {
        credentials: "include"
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Unable to load feed."
      );
    }

    let posts = Array.isArray(data.posts)
      ? data.posts
      : [];

    /*
      Client-side final duplicate protection.
    */
    posts = posts.filter((post) => {
      if (!post || !post.id) return false;

      const id = String(post.id);

      if (seenPostIds.has(id)) {
        return false;
      }

      seenPostIds.add(id);

      return true;
    });

    if (reset && feedContainer) {
      feedContainer.innerHTML = "";
    }

    if (posts.length > 0) {
      renderPosts(posts);
    }

    const serverHasMore =
      typeof data.hasMore === "boolean"
        ? data.hasMore
        : posts.length >= FEED_LIMIT;

    hasMorePosts =
      serverHasMore && posts.length > 0;

    feedOffset +=
      typeof data.nextOffset === "number"
        ? data.nextOffset - feedOffset
        : posts.length;

    updateLoadMoreButton();

    if (reset && posts.length === 0) {
      showEmptyFeed();
    }

  } catch (error) {
    console.error("Feed error:", error);

    if (reset) {
      showFeedError(
        error.message || "Unable to load posts."
      );
    }

  } finally {
    loadingFeed = false;
  }
}

/* =========================================================
   FEED CONTAINER
========================================================= */

function getFeedContainer() {
  return (
    document.getElementById("feed") ||
    document.getElementById("feedContainer") ||
    document.querySelector(".feed") ||
    document.querySelector(".posts")
  );
}

/* =========================================================
   RENDER POSTS
========================================================= */

function renderPosts(posts) {
  const feedContainer = getFeedContainer();

  if (!feedContainer) {
    console.error(
      "Feed container not found. Add id='feed' to your feed container."
    );
    return;
  }

  posts.forEach((post) => {
    const card = createPostCard(post);

    if (card) {
      feedContainer.appendChild(card);
    }
  });
}

/* =========================================================
   CREATE POST CARD
========================================================= */

function createPostCard(post) {
  if (!post || !post.id) return null;

  const article = document.createElement("article");

  article.className = "post-card";
  article.dataset.postId = post.id;

  const user = post.user || post.author || {};

  const username =
    user.username ||
    post.username ||
    "User";

  const displayName =
    user.displayName ||
    user.name ||
    username;

  const profilePicture =
    user.profilePicture ||
    user.avatar ||
    "/images/default-avatar.png";

  const text =
    post.text ||
    post.content ||
    post.caption ||
    "";

  const image =
    post.image ||
    "";

  const likesCount =
    Number(post.likesCount || post.likeCount || 0);

  const commentsCount =
    Number(post.commentsCount || post.commentCount || 0);

  const liked =
    Boolean(post.liked);

  const verified =
    Boolean(user.verified);

  const createdAt =
    post.createdAt
      ? formatPostDate(post.createdAt)
      : "";

  article.innerHTML = `
    <div class="post-header">

      <a
        href="/profile.html?username=${encodeURIComponent(username)}"
        class="post-author"
      >
        <img
          src="${escapeAttribute(profilePicture)}"
          alt="${escapeAttribute(displayName)}"
          class="post-avatar"
          onerror="this.src='/images/default-avatar.png'"
        >

        <div class="post-author-info">
          <div class="post-author-name">
            ${escapeHTML(displayName)}

            ${
              verified
                ? `<span class="verified-badge" title="Verified">✓</span>`
                : ""
            }
          </div>

          <div class="post-author-meta">
            @${escapeHTML(username)}
            ${createdAt ? ` · ${escapeHTML(createdAt)}` : ""}
          </div>
        </div>
      </a>

      <button
        class="post-menu"
        type="button"
        aria-label="Post options"
      >
        ⋯
      </button>

    </div>

    ${
      text
        ? `
          <div class="post-text">
            ${escapeHTML(text).replace(/\n/g, "<br>")}
          </div>
        `
        : ""
    }

    ${
      image
        ? `
          <div class="post-image-wrapper">
            <img
              src="${escapeAttribute(image)}"
              class="post-image"
              alt="Post image"
              loading="lazy"
              onerror="this.parentElement.style.display='none'"
            >
          </div>
        `
        : ""
    }

    <div class="post-stats">
      <span class="likes-count">
        ${likesCount} ${likesCount === 1 ? "like" : "likes"}
      </span>

      <span class="comments-count">
        ${commentsCount}
        ${commentsCount === 1 ? "comment" : "comments"}
      </span>
    </div>

    <div class="post-actions">

      <button
        class="post-action like-button ${liked ? "liked" : ""}"
        data-post-id="${escapeAttribute(post.id)}"
        type="button"
      >
        ${liked ? "♥" : "♡"} Like
      </button>

      <button
        class="post-action comment-button"
        data-post-id="${escapeAttribute(post.id)}"
        type="button"
      >
        💬 Comment
      </button>

      <button
        class="post-action share-button"
        data-post-id="${escapeAttribute(post.id)}"
        type="button"
      >
        ↗ Share
      </button>

    </div>

    <div
      class="comments-area"
      id="comments-${escapeAttribute(post.id)}"
      hidden
    >
      <div class="comments-list"></div>

      <form class="comment-form">
        <input
          type="text"
          name="comment"
          placeholder="Write a comment..."
          maxlength="500"
          autocomplete="off"
        >

        <button type="submit">
          Post
        </button>
      </form>
    </div>
  `;

  setupPostEvents(article, post);

  return article;
}

/* =========================================================
   POST EVENTS
========================================================= */

function setupPostEvents(article, post) {
  const likeButton =
    article.querySelector(".like-button");

  if (likeButton) {
    likeButton.addEventListener("click", async () => {
      await toggleLike(post, article);
    });
  }

  const commentButton =
    article.querySelector(".comment-button");

  if (commentButton) {
    commentButton.addEventListener("click", async () => {
      await toggleComments(post, article);
    });
  }

  const commentForm =
    article.querySelector(".comment-form");

  if (commentForm) {
    commentForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const input =
        commentForm.querySelector("input[name='comment']");

      if (!input) return;

      const text = input.value.trim();

      if (!text) return;

      await addComment(
        post,
        article,
        text,
        input
      );
    });
  }

  const shareButton =
    article.querySelector(".share-button");

  if (shareButton) {
    shareButton.addEventListener("click", async () => {
      await sharePost(post);
    });
  }
}

/* =========================================================
   LIKE
========================================================= */

async function toggleLike(post, article) {
  const button =
    article.querySelector(".like-button");

  if (!button) return;

  button.disabled = true;

  try {
    const response = await fetch(
      `/api/posts/${encodeURIComponent(post.id)}/like`,
      {
        method: "POST",
        credentials: "include"
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Unable to like post."
      );
    }

    const liked =
      Boolean(data.liked);

    const count =
      Number(
        data.likesCount ??
        data.likeCount ??
        0
      );

    button.classList.toggle(
      "liked",
      liked
    );

    button.innerHTML =
      `${liked ? "♥" : "♡"} Like`;

    const countElement =
      article.querySelector(".likes-count");

    if (countElement) {
      countElement.textContent =
        `${count} ${count === 1 ? "like" : "likes"}`;
    }

  } catch (error) {
    console.error("Like error:", error);
    alert(error.message || "Unable to like post.");
  } finally {
    button.disabled = false;
  }
}

/* =========================================================
   COMMENTS
========================================================= */

async function toggleComments(post, article) {
  const area =
    article.querySelector(".comments-area");

  if (!area) return;

  if (!area.hidden) {
    area.hidden = true;
    return;
  }

  area.hidden = false;

  await loadComments(post, article);
}

async function loadComments(post, article) {
  const area =
    article.querySelector(".comments-area");

  if (!area) return;

  const list =
    area.querySelector(".comments-list");

  if (!list) return;

  list.innerHTML = `
    <div class="comments-loading">
      Loading comments...
    </div>
  `;

  try {
    const response = await fetch(
      `/api/posts/${encodeURIComponent(post.id)}/comments`,
      {
        credentials: "include"
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Unable to load comments."
      );
    }

    const comments =
      Array.isArray(data.comments)
        ? data.comments
        : [];

    if (comments.length === 0) {
      list.innerHTML = `
        <div class="no-comments">
          No comments yet.
        </div>
      `;

      return;
    }

    list.innerHTML = "";

    comments.forEach((comment) => {
      const item =
        document.createElement("div");

      item.className = "comment-item";

      const user =
        comment.user ||
        comment.author ||
        {};

      const username =
        user.username ||
        "User";

      const displayName =
        user.displayName ||
        user.name ||
        username;

      const avatar =
        user.profilePicture ||
        user.avatar ||
        "/images/default-avatar.png";

      item.innerHTML = `
        <img
          src="${escapeAttribute(avatar)}"
          class="comment-avatar"
          alt=""
          onerror="this.src='/images/default-avatar.png'"
        >

        <div class="comment-body">
          <div class="comment-name">
            ${escapeHTML(displayName)}
          </div>

          <div class="comment-text">
            ${escapeHTML(
              comment.text ||
              comment.content ||
              ""
            )}
          </div>
        </div>
      `;

      list.appendChild(item);
    });

  } catch (error) {
    console.error("Comments error:", error);

    list.innerHTML = `
      <div class="comments-error">
        Unable to load comments.
      </div>
    `;
  }
}

/* =========================================================
   ADD COMMENT
========================================================= */

async function addComment(
  post,
  article,
  text,
  input
) {
  try {
    const response = await fetch(
      `/api/posts/${encodeURIComponent(post.id)}/comments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          text
        })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Unable to add comment."
      );
    }

    input.value = "";

    const commentsCount =
      article.querySelector(".comments-count");

    if (commentsCount) {
      const current =
        Number(
          commentsCount.dataset.count ||
          post.commentsCount ||
          0
        ) + 1;

      commentsCount.dataset.count =
        String(current);

      commentsCount.textContent =
        `${current} ${current === 1 ? "comment" : "comments"}`;
    }

    await loadComments(post, article);

  } catch (error) {
    console.error("Comment error:", error);
    alert(
      error.message ||
      "Unable to add comment."
    );
  }
}

/* =========================================================
   SHARE
========================================================= */

async function sharePost(post) {
  const url =
    `${window.location.origin}/feed.html#post-${post.id}`;

  try {
    if (navigator.share) {
      await navigator.share({
        title: "Pulse Social",
        text: "Check out this post on Pulse Social.",
        url
      });

      return;
    }

    await navigator.clipboard.writeText(url);

    alert("Post link copied.");
  } catch (error) {
    console.log("Share cancelled.");
  }
}

/* =========================================================
   EMPTY STATE
========================================================= */

function showEmptyFeed() {
  const container = getFeedContainer();

  if (!container) return;

  container.innerHTML = `
    <div class="feed-empty">
      <div class="feed-empty-icon">◎</div>

      <h3>No posts yet</h3>

      <p>
        Follow people or create your first post
        to start your feed.
      </p>
    </div>
  `;
}

/* =========================================================
   ERROR
========================================================= */

function showFeedError(message) {
  const container = getFeedContainer();

  if (!container) return;

  container.innerHTML = `
    <div class="feed-error">
      <h3>Unable to load feed</h3>

      <p>${escapeHTML(message)}</p>

      <button
        type="button"
        onclick="loadFeed(true)"
      >
        Try Again
      </button>
    </div>
  `;
}

/* =========================================================
   LOAD MORE BUTTON
========================================================= */

function updateLoadMoreButton() {
  const button =
    document.getElementById("loadMorePosts");

  if (!button) return;

  if (!hasMorePosts) {
    button.style.display = "none";
    return;
  }

  button.style.display = "block";

  button.disabled = loadingFeed;

  button.textContent =
    loadingFeed
      ? "Loading..."
      : "Load more";
}

/* =========================================================
   DATE FORMAT
========================================================= */

function formatPostDate(value) {
  const date =
    new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now =
    Date.now();

  const difference =
    Math.floor(
      (now - date.getTime()) / 1000
    );

  if (difference < 60) {
    return "Just now";
  }

  if (difference < 3600) {
    return `${Math.floor(difference / 60)}m`;
  }

  if (difference < 86400) {
    return `${Math.floor(difference / 3600)}h`;
  }

  if (difference < 604800) {
    return `${Math.floor(difference / 86400)}d`;
  }

  return date.toLocaleDateString();
}

/* =========================================================
   SECURITY HELPERS
========================================================= */

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHTML(value);
}

/* =========================================================
   EXPOSE FOR BUTTONS / OTHER FILES
========================================================= */

window.loadFeed = loadFeed;