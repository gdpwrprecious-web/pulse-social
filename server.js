require("dotenv").config();

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

const ROOT = __dirname;

const STORAGE_ROOT = path.resolve(
  process.env.STORAGE_ROOT || path.join(ROOT, "storage")
);

const DATA_DIR = path.join(STORAGE_ROOT, "data");
const UPLOADS_DIR = path.join(STORAGE_ROOT, "uploads");

const PROFILE_UPLOADS = path.join(UPLOADS_DIR, "profiles");
const COVER_UPLOADS = path.join(UPLOADS_DIR, "covers");
const POST_UPLOADS = path.join(UPLOADS_DIR, "posts");
const MESSAGE_UPLOADS = path.join(UPLOADS_DIR, "messages");

[
  STORAGE_ROOT,
  DATA_DIR,
  UPLOADS_DIR,
  PROFILE_UPLOADS,
  COVER_UPLOADS,
  POST_UPLOADS,
  MESSAGE_UPLOADS
].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/* =========================================================
   EXPRESS
========================================================= */

app.set("trust proxy", 1);

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

/* =========================================================
   SESSION
========================================================= */

const SESSION_SECRET =
  process.env.SESSION_SECRET || "pulse-social-development-secret";

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 30,
      httpOnly: true,
      sameSite: "lax",
      secure: IS_PRODUCTION
    }
  })
);

/* =========================================================
   JSON DATABASE
========================================================= */

const FILES = {
  users: path.join(DATA_DIR, "users.json"),
  posts: path.join(DATA_DIR, "posts.json"),
  comments: path.join(DATA_DIR, "comments.json"),
  likes: path.join(DATA_DIR, "likes.json"),
  follows: path.join(DATA_DIR, "follows.json"),
  notifications: path.join(DATA_DIR, "notifications.json"),
  messages: path.join(DATA_DIR, "messages.json"),
  verification: path.join(DATA_DIR, "verification_requests.json")
};

function ensureJsonFile(file, defaultValue = []) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2));
  }
}

Object.values(FILES).forEach((file) => ensureJsonFile(file, []));

function readJson(file, fallback = []) {
  try {
    if (!fs.existsSync(file)) {
      return fallback;
    }

    const raw = fs.readFileSync(file, "utf8");

    if (!raw.trim()) {
      return fallback;
    }

    return JSON.parse(raw);
  } catch (error) {
    console.error("JSON READ ERROR:", file, error.message);
    return fallback;
  }
}

function writeJson(file, data) {
  const tempFile = `${file}.tmp`;

  fs.writeFileSync(
    tempFile,
    JSON.stringify(data, null, 2),
    "utf8"
  );

  fs.renameSync(tempFile, file);
}

function now() {
  return new Date().toISOString();
}

function makeId(prefix = "id") {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(5).toString("hex")}`;
}

/* =========================================================
   DATABASE HELPERS
========================================================= */

function users() {
  return readJson(FILES.users, []);
}

function posts() {
  return readJson(FILES.posts, []);
}

function comments() {
  return readJson(FILES.comments, []);
}

function likes() {
  return readJson(FILES.likes, []);
}

function follows() {
  return readJson(FILES.follows, []);
}

function notifications() {
  return readJson(FILES.notifications, []);
}

function messages() {
  return readJson(FILES.messages, []);
}

function verificationRequests() {
  return readJson(FILES.verification, []);
}

/* =========================================================
   NORMALIZATION
========================================================= */

function normalizeUser(user) {
  if (!user) return null;

  if (!user.id) {
    user.id = makeId("user");
  }

  if (!user.username) {
    user.username =
      String(user.name || "user")
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "")
        .slice(0, 25) || `user${Date.now()}`;
  }

  return user;
}

function getUserById(id) {
  return users().find((u) => String(u.id) === String(id));
}

function getUserByUsername(username) {
  const target = String(username || "").replace(/^@/, "").toLowerCase();

  return users().find(
    (u) => String(u.username || "").toLowerCase() === target
  );
}

function getPostById(id) {
  return posts().find((p) => String(p.id) === String(id));
}

/* =========================================================
   COUNTS
========================================================= */

function followerCount(userId) {
  return follows().filter(
    (f) => String(f.followingId) === String(userId)
  ).length;
}

function followingCount(userId) {
  return follows().filter(
    (f) => String(f.followerId) === String(userId)
  ).length;
}

function postCount(userId) {
  return posts().filter(
    (p) => String(p.userId) === String(userId)
  ).length;
}

function likeCount(postId) {
  return likes().filter(
    (l) => String(l.postId) === String(postId)
  ).length;
}

function commentCount(postId) {
  return comments().filter(
    (c) => String(c.postId) === String(postId)
  ).length;
}

function isFollowing(followerId, followingId) {
  return follows().some(
    (f) =>
      String(f.followerId) === String(followerId) &&
      String(f.followingId) === String(followingId)
  );
}

/* =========================================================
   SAFE USER
========================================================= */

function safeUser(user, viewerId = null) {
  if (!user) return null;

  return {
    id: user.id,
    name: user.name || user.displayName || user.username || "User",
    displayName:
      user.displayName ||
      user.name ||
      user.username ||
      "User",

    username: user.username || "user",

    email: user.email || "",

    bio: user.bio || "",

    website: user.website || "",

    profilePicture:
      user.profilePicture ||
      user.profileImage ||
      user.avatar ||
      "/images/default-avatar.png",

    profileImage:
      user.profileImage ||
      user.profilePicture ||
      user.avatar ||
      "/images/default-avatar.png",

    avatar:
      user.avatar ||
      user.profilePicture ||
      user.profileImage ||
      "/images/default-avatar.png",

    coverPhoto:
      user.coverPhoto ||
      user.coverImage ||
      user.cover ||
      "",

    coverImage:
      user.coverImage ||
      user.coverPhoto ||
      user.cover ||
      "",

    cover:
      user.cover ||
      user.coverPhoto ||
      user.coverImage ||
      "",

    role: user.role || "user",

    verified: Boolean(
      user.verified ||
      user.isVerified ||
      user.verificationStatus === "approved"
    ),

    isVerified: Boolean(
      user.verified ||
      user.isVerified ||
      user.verificationStatus === "approved"
    ),

    verificationStatus:
      user.verificationStatus || "none",

    createdAt: user.createdAt || null,

    followersCount: followerCount(user.id),
    followingCount: followingCount(user.id),
    postsCount: postCount(user.id),

    isFollowing:
      viewerId && String(viewerId) !== String(user.id)
        ? isFollowing(viewerId, user.id)
        : false,

    isMe:
      viewerId
        ? String(viewerId) === String(user.id)
        : false
  };
}

/* =========================================================
   SAFE POST
========================================================= */

function safePost(post, viewerId = null) {
  const author = getUserById(post.userId);

  const postLikes = likes().filter(
    (l) => String(l.postId) === String(post.id)
  );

  return {
    id: post.id,

    userId: post.userId,

    author: safeUser(author, viewerId),

    user: safeUser(author, viewerId),

    content:
      post.content ||
      post.caption ||
      post.text ||
      "",

    caption:
      post.caption ||
      post.content ||
      post.text ||
      "",

    image:
      post.image ||
      post.imageUrl ||
      null,

    imageUrl:
      post.imageUrl ||
      post.image ||
      null,

    video:
      post.video ||
      post.videoUrl ||
      null,

    videoUrl:
      post.videoUrl ||
      post.video ||
      null,

    mediaType:
      post.mediaType ||
      (post.video || post.videoUrl ? "video" : "image"),

    visibility:
      post.visibility || "public",

    createdAt:
      post.createdAt || now(),

    updatedAt:
      post.updatedAt || post.createdAt || now(),

    likesCount: postLikes.length,

    likeCount: postLikes.length,

    commentsCount: commentCount(post.id),

    commentCount: commentCount(post.id),

    liked:
      viewerId
        ? postLikes.some(
            (l) => String(l.userId) === String(viewerId)
          )
        : false,

    isLiked:
      viewerId
        ? postLikes.some(
            (l) => String(l.userId) === String(viewerId)
          )
        : false
  };
}

/* =========================================================
   AUTH
========================================================= */

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({
      success: false,
      message: "Please log in."
    });
  }

  next();
}

function isAdminUser(user) {
  if (!user) return false;

  const adminUsername =
    process.env.ADMIN_USERNAME || "";

  return (
    user.role === "admin" ||
    user.role === "superadmin" ||
    String(user.username).toLowerCase() ===
      String(adminUsername).toLowerCase()
  );
}

function requireAdmin(req, res, next) {
  const user = getUserById(req.session.userId);

  if (!user || !isAdminUser(user)) {
    return res.status(403).json({
      success: false,
      message: "Administrator access required."
    });
  }

  next();
}

/* =========================================================
   MULTER
========================================================= */

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const field = file.fieldname || "";

    if (
      field === "profilePicture" ||
      field === "profileImage" ||
      field === "avatar"
    ) {
      return cb(null, PROFILE_UPLOADS);
    }

    if (
      field === "coverPhoto" ||
      field === "coverImage" ||
      field === "cover"
    ) {
      return cb(null, COVER_UPLOADS);
    }

    if (
      field === "video" ||
      file.mimetype.startsWith("video/")
    ) {
      return cb(null, POST_UPLOADS);
    }

    if (
      field === "image" ||
      field === "postImage" ||
      file.mimetype.startsWith("image/")
    ) {
      return cb(null, POST_UPLOADS);
    }

    if (field === "messageImage") {
      return cb(null, MESSAGE_UPLOADS);
    }

    cb(null, POST_UPLOADS);
  },

  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname || "");

    cb(
      null,
      `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`
    );
  }
});

const upload = multer({
  storage,

  limits: {
    fileSize: 100 * 1024 * 1024
  },

  fileFilter: function (req, file, cb) {
    const allowed =
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("video/");

    if (!allowed) {
      return cb(
        new Error("Only image and video files are allowed.")
      );
    }

    cb(null, true);
  }
});

/* =========================================================
   HEALTH
========================================================= */

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "ok",
    version: "facebook-style-1.0.0",
    storageRoot: STORAGE_ROOT,
    features: [
      "authentication",
      "facebook-feed",
      "profiles",
      "posts",
      "images",
      "videos",
      "likes",
      "comments",
      "follows",
      "notifications",
      "messages",
      "verification",
      "admin"
    ]
  });
});

/* =========================================================
   AUTH ROUTES
========================================================= */

app.post("/api/register", async (req, res) => {
  try {
    const {
      name,
      username,
      email,
      password
    } = req.body;

    if (!name || !username || !email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Name, username, email and password are required."
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 6 characters."
      });
    }

    const allUsers = users();

    const normalizedUsername =
      String(username)
        .trim()
        .toLowerCase()
        .replace(/^@/, "")
        .replace(/[^a-z0-9_]/g, "");

    const normalizedEmail =
      String(email).trim().toLowerCase();

    if (!normalizedUsername) {
      return res.status(400).json({
        success: false,
        message: "Choose a valid username."
      });
    }

    if (
      allUsers.some(
        (u) =>
          String(u.username || "").toLowerCase() ===
          normalizedUsername
      )
    ) {
      return res.status(409).json({
        success: false,
        message: "Username already exists."
      });
    }

    if (
      allUsers.some(
        (u) =>
          String(u.email || "").toLowerCase() ===
          normalizedEmail
      )
    ) {
      return res.status(409).json({
        success: false,
        message: "Email already exists."
      });
    }

    const passwordHash = await bcrypt.hash(
      String(password),
      12
    );

    const user = {
      id: makeId("user"),
      name: String(name).trim(),
      displayName: String(name).trim(),
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
      bio: "",
      website: "",
      profilePicture:
        "/images/default-avatar.png",
      profileImage:
        "/images/default-avatar.png",
      avatar:
        "/images/default-avatar.png",
      coverPhoto: "",
      coverImage: "",
      cover: "",
      role: "user",
      verified: false,
      isVerified: false,
      verificationStatus: "none",
      createdAt: now()
    };

    allUsers.push(user);

    writeJson(FILES.users, allUsers);

    req.session.userId = user.id;

    res.json({
      success: true,
      user: safeUser(user, user.id)
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Unable to create account."
    });
  }
});

app.post("/api/signup", async (req, res) => {
  req.url = "/api/register";
  return app._router.handle(req, res, () => {});
});

app.post("/api/login", async (req, res) => {
  try {
    const {
      identifier,
      email,
      username,
      password
    } = req.body;

    const loginIdentifier =
      String(
        identifier ||
        email ||
        username ||
        ""
      )
        .trim()
        .toLowerCase();

    if (!loginIdentifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Enter your login details."
      });
    }

    const allUsers = users();

    const user = allUsers.find(
      (u) =>
        String(u.email || "").toLowerCase() ===
          loginIdentifier ||
        String(u.username || "").toLowerCase() ===
          loginIdentifier
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email/username or password."
      });
    }

    if (!user.passwordHash) {
      return res.status(500).json({
        success: false,
        message:
          "This account has no valid password. Please create the account again."
      });
    }

    const valid = await bcrypt.compare(
      String(password),
      String(user.passwordHash)
    );

    if (!valid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email/username or password."
      });
    }

    req.session.userId = user.id;

    res.json({
      success: true,
      user: safeUser(user, user.id)
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Unable to sign in."
    });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({
      success: true
    });
  });
});

app.get("/api/me", (req, res) => {
  const user = getUserById(req.session.userId);

  if (!user) {
    return res.json({
      success: true,
      authenticated: false,
      user: null
    });
  }

  res.json({
    success: true,
    authenticated: true,
    user: safeUser(user, user.id)
  });
});

/* =========================================================
   PROFILE
========================================================= */

app.get("/api/users/:username", (req, res) => {
  const user = getUserByUsername(
    req.params.username
  );

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found."
    });
  }

  res.json({
    success: true,
    user: safeUser(user, req.session.userId)
  });
});

app.put("/api/profile", requireAuth, (req, res) => {
  const allUsers = users();

  const index = allUsers.findIndex(
    (u) =>
      String(u.id) ===
      String(req.session.userId)
  );

  if (index === -1) {
    return res.status(404).json({
      success: false,
      message: "User not found."
    });
  }

  const user = allUsers[index];

  const {
    name,
    displayName,
    bio,
    website
  } = req.body;

  if (name !== undefined) {
    user.name = String(name).trim();
  }

  if (displayName !== undefined) {
    user.displayName =
      String(displayName).trim();
  }

  if (bio !== undefined) {
    user.bio = String(bio).trim();
  }

  if (website !== undefined) {
    user.website =
      String(website).trim();
  }

  user.updatedAt = now();

  writeJson(FILES.users, allUsers);

  res.json({
    success: true,
    user: safeUser(
      user,
      req.session.userId
    )
  });
});

app.post(
  "/api/profile/picture",
  requireAuth,
  upload.single("profilePicture"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Choose a profile picture."
      });
    }

    const allUsers = users();

    const index = allUsers.findIndex(
      (u) =>
        String(u.id) ===
        String(req.session.userId)
    );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    const url =
      `/uploads/profiles/${req.file.filename}`;

    allUsers[index].profilePicture = url;
    allUsers[index].profileImage = url;
    allUsers[index].avatar = url;

    writeJson(FILES.users, allUsers);

    res.json({
      success: true,
      user: safeUser(
        allUsers[index],
        req.session.userId
      )
    });
  }
);

app.post(
  "/api/profile/cover",
  requireAuth,
  upload.single("coverPhoto"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Choose a cover photo."
      });
    }

    const allUsers = users();

    const index = allUsers.findIndex(
      (u) =>
        String(u.id) ===
        String(req.session.userId)
    );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    const url =
      `/uploads/covers/${req.file.filename}`;

    allUsers[index].coverPhoto = url;
    allUsers[index].coverImage = url;
    allUsers[index].cover = url;

    writeJson(FILES.users, allUsers);

    res.json({
      success: true,
      user: safeUser(
        allUsers[index],
        req.session.userId
      )
    });
  }
);

app.post(
  "/api/profile/cover-photo",
  requireAuth,
  upload.single("coverPhoto"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Choose a cover photo."
      });
    }

    const allUsers = users();

    const index = allUsers.findIndex(
      (u) =>
        String(u.id) ===
        String(req.session.userId)
    );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    const url =
      `/uploads/covers/${req.file.filename}`;

    allUsers[index].coverPhoto = url;
    allUsers[index].coverImage = url;
    allUsers[index].cover = url;

    writeJson(FILES.users, allUsers);

    res.json({
      success: true,
      user: safeUser(
        allUsers[index],
        req.session.userId
      )
    });
  }
);

app.delete(
  "/api/profile/cover",
  requireAuth,
  (req, res) => {
    const allUsers = users();

    const index = allUsers.findIndex(
      (u) =>
        String(u.id) ===
        String(req.session.userId)
    );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    allUsers[index].coverPhoto = "";
    allUsers[index].coverImage = "";
    allUsers[index].cover = "";

    writeJson(FILES.users, allUsers);

    res.json({
      success: true,
      user: safeUser(
        allUsers[index],
        req.session.userId
      )
    });
  }
);

/* =========================================================
   USER POSTS
========================================================= */

app.get(
  "/api/users/:username/posts",
  (req, res) => {
    const user = getUserByUsername(
      req.params.username
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    const userPosts = posts()
      .filter(
        (p) =>
          String(p.userId) ===
          String(user.id)
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt) -
          new Date(a.createdAt)
      )
      .map((p) =>
        safePost(
          p,
          req.session.userId
        )
      );

    res.json({
      success: true,
      posts: userPosts
    });
  }
);

/* =========================================================
   CREATE POST
========================================================= */

app.post(
  "/api/posts",
  requireAuth,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 }
  ]),
  (req, res) => {
    try {
      const user = getUserById(
        req.session.userId
      );

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found."
        });
      }

      const content =
        String(
          req.body.content ||
          req.body.caption ||
          req.body.text ||
          ""
        ).trim();

      const imageFile =
        req.files?.image?.[0];

      const videoFile =
        req.files?.video?.[0];

      if (
        !content &&
        !imageFile &&
        !videoFile
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Write something or add a photo/video."
        });
      }

      let image = null;
      let video = null;

      if (imageFile) {
        image =
          `/uploads/posts/${imageFile.filename}`;
      }

      if (videoFile) {
        video =
          `/uploads/posts/${videoFile.filename}`;
      }

      const allPosts = posts();

      const post = {
        id: makeId("post"),
        userId: user.id,
        content,
        caption: content,
        image,
        imageUrl: image,
        video,
        videoUrl: video,
        mediaType: video
          ? "video"
          : image
          ? "image"
          : "text",
        visibility:
          req.body.visibility ||
          "public",
        createdAt: now(),
        updatedAt: now()
      };

      allPosts.push(post);

      writeJson(
        FILES.posts,
        allPosts
      );

      res.json({
        success: true,
        post: safePost(
          post,
          user.id
        )
      });
    } catch (error) {
      console.error(
        "CREATE POST ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Unable to publish post."
      });
    }
  }
);

/* =========================================================
   FEED
========================================================= */

app.get(
  "/api/feed",
  requireAuth,
  (req, res) => {
    const viewerId =
      req.session.userId;

    const mode =
      String(
        req.query.mode || "all"
      ).toLowerCase();

    const allPosts = posts();

    let feedPosts = allPosts.filter(
      (post) => {
        if (
          post.visibility &&
          post.visibility === "private"
        ) {
          return (
            String(post.userId) ===
            String(viewerId)
          );
        }

        return true;
      }
    );

    if (mode === "following") {
      const followingIds =
        follows()
          .filter(
            (f) =>
              String(f.followerId) ===
              String(viewerId)
          )
          .map((f) =>
            String(f.followingId)
          );

      followingIds.push(
        String(viewerId)
      );

      feedPosts =
        feedPosts.filter((p) =>
          followingIds.includes(
            String(p.userId)
          )
        );
    }

    feedPosts = feedPosts
      .sort(
        (a, b) =>
          new Date(b.createdAt) -
          new Date(a.createdAt)
      )
      .map((p) =>
        safePost(
          p,
          viewerId
        )
      );

    res.json({
      success: true,
      mode,
      posts: feedPosts
    });
  }
);

/* =========================================================
   SINGLE POST
========================================================= */

app.get(
  "/api/posts/:id",
  (req, res) => {
    const post =
      getPostById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found."
      });
    }

    res.json({
      success: true,
      post: safePost(
        post,
        req.session.userId
      )
    });
  }
);

app.delete(
  "/api/posts/:id",
  requireAuth,
  (req, res) => {
    const allPosts = posts();

    const post =
      allPosts.find(
        (p) =>
          String(p.id) ===
          String(req.params.id)
      );

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found."
      });
    }

    const user =
      getUserById(req.session.userId);

    if (
      String(post.userId) !==
        String(req.session.userId) &&
      !isAdminUser(user)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You cannot delete this post."
      });
    }

    writeJson(
      FILES.posts,
      allPosts.filter(
        (p) =>
          String(p.id) !==
          String(req.params.id)
      )
    );

    writeJson(
      FILES.likes,
      likes().filter(
        (l) =>
          String(l.postId) !==
          String(req.params.id)
      )
    );

    writeJson(
      FILES.comments,
      comments().filter(
        (c) =>
          String(c.postId) !==
          String(req.params.id)
      )
    );

    res.json({
      success: true
    });
  }
);

/* =========================================================
   LIKES
========================================================= */

app.post(
  "/api/posts/:id/like",
  requireAuth,
  (req, res) => {
    const post =
      getPostById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found."
      });
    }

    const allLikes = likes();

    const existing =
      allLikes.findIndex(
        (l) =>
          String(l.postId) ===
            String(post.id) &&
          String(l.userId) ===
            String(req.session.userId)
      );

    let liked = false;

    if (existing >= 0) {
      allLikes.splice(
        existing,
        1
      );
    } else {
      allLikes.push({
        id: makeId("like"),
        postId: post.id,
        userId: req.session.userId,
        createdAt: now()
      });

      liked = true;

      if (
        String(post.userId) !==
        String(req.session.userId)
      ) {
        createNotification({
          userId: post.userId,
          actorId: req.session.userId,
          type: "like",
          postId: post.id
        });
      }
    }

    writeJson(
      FILES.likes,
      allLikes
    );

    res.json({
      success: true,
      liked,
      likesCount:
        allLikes.filter(
          (l) =>
            String(l.postId) ===
            String(post.id)
        ).length
    });
  }
);

/* =========================================================
   COMMENTS
========================================================= */

app.get(
  "/api/posts/:id/comments",
  (req, res) => {
    const post =
      getPostById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found."
      });
    }

    const result =
      comments()
        .filter(
          (c) =>
            String(c.postId) ===
            String(post.id)
        )
        .sort(
          (a, b) =>
            new Date(a.createdAt) -
            new Date(b.createdAt)
        )
        .map((comment) => ({
          ...comment,
          user: safeUser(
            getUserById(
              comment.userId
            ),
            req.session.userId
          )
        }));

    res.json({
      success: true,
      comments: result
    });
  }
);

app.post(
  "/api/posts/:id/comments",
  requireAuth,
  (req, res) => {
    const post =
      getPostById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found."
      });
    }

    const text =
      String(
        req.body.text ||
        req.body.comment ||
        req.body.content ||
        ""
      ).trim();

    if (!text) {
      return res.status(400).json({
        success: false,
        message: "Write a comment."
      });
    }

    const allComments = comments();

    const comment = {
      id: makeId("comment"),
      postId: post.id,
      userId: req.session.userId,
      text,
      content: text,
      createdAt: now()
    };

    allComments.push(comment);

    writeJson(
      FILES.comments,
      allComments
    );

    if (
      String(post.userId) !==
      String(req.session.userId)
    ) {
      createNotification({
        userId: post.userId,
        actorId: req.session.userId,
        type: "comment",
        postId: post.id
      });
    }

    res.json({
      success: true,
      comment: {
        ...comment,
        user: safeUser(
          getUserById(
            req.session.userId
          ),
          req.session.userId
        )
      }
    });
  }
);

app.delete(
  "/api/comments/:id",
  requireAuth,
  (req, res) => {
    const allComments =
      comments();

    const comment =
      allComments.find(
        (c) =>
          String(c.id) ===
          String(req.params.id)
      );

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found."
      });
    }

    const user =
      getUserById(req.session.userId);

    if (
      String(comment.userId) !==
        String(req.session.userId) &&
      !isAdminUser(user)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You cannot delete this comment."
      });
    }

    writeJson(
      FILES.comments,
      allComments.filter(
        (c) =>
          String(c.id) !==
          String(req.params.id)
      )
    );

    res.json({
      success: true
    });
  }
);

/* =========================================================
   FOLLOWS
========================================================= */

app.post(
  "/api/users/:id/follow",
  requireAuth,
  (req, res) => {
    const target =
      getUserById(req.params.id);

    if (!target) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    if (
      String(target.id) ===
      String(req.session.userId)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "You cannot follow yourself."
      });
    }

    const allFollows = follows();

    const index =
      allFollows.findIndex(
        (f) =>
          String(f.followerId) ===
            String(req.session.userId) &&
          String(f.followingId) ===
            String(target.id)
      );

    let following = false;

    if (index >= 0) {
      allFollows.splice(
        index,
        1
      );
    } else {
      allFollows.push({
        id: makeId("follow"),
        followerId:
          req.session.userId,
        followingId: target.id,
        createdAt: now()
      });

      following = true;

      createNotification({
        userId: target.id,
        actorId:
          req.session.userId,
        type: "follow"
      });
    }

    writeJson(
      FILES.follows,
      allFollows
    );

    res.json({
      success: true,
      following,
      followersCount:
        followerCount(target.id)
    });
  }
);

app.get(
  "/api/users/:id/followers",
  (req, res) => {
    const target =
      getUserById(req.params.id);

    if (!target) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    const result =
      follows()
        .filter(
          (f) =>
            String(f.followingId) ===
            String(target.id)
        )
        .map((f) =>
          safeUser(
            getUserById(
              f.followerId
            ),
            req.session.userId
          )
        )
        .filter(Boolean);

    res.json({
      success: true,
      users: result
    });
  }
);

app.get(
  "/api/users/:id/following",
  (req, res) => {
    const target =
      getUserById(req.params.id);

    if (!target) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    const result =
      follows()
        .filter(
          (f) =>
            String(f.followerId) ===
            String(target.id)
        )
        .map((f) =>
          safeUser(
            getUserById(
              f.followingId
            ),
            req.session.userId
          )
        )
        .filter(Boolean);

    res.json({
      success: true,
      users: result
    });
  }
);

/* =========================================================
   SEARCH
========================================================= */

app.get(
  "/api/search",
  requireAuth,
  (req, res) => {
    const q =
      String(
        req.query.q || ""
      )
        .trim()
        .toLowerCase();

    if (!q) {
      return res.json({
        success: true,
        users: [],
        posts: []
      });
    }

    const foundUsers =
      users()
        .filter(
          (u) =>
            String(
              u.name || ""
            )
              .toLowerCase()
              .includes(q) ||
            String(
              u.username || ""
            )
              .toLowerCase()
              .includes(q)
        )
        .slice(0, 20)
        .map((u) =>
          safeUser(
            u,
            req.session.userId
          )
        );

    const foundPosts =
      posts()
        .filter(
          (p) =>
            String(
              p.content || ""
            )
              .toLowerCase()
              .includes(q)
        )
        .slice(0, 30)
        .map((p) =>
          safePost(
            p,
            req.session.userId
          )
        );

    res.json({
      success: true,
      users: foundUsers,
      posts: foundPosts
    });
  }
);

/* =========================================================
   NOTIFICATIONS
========================================================= */

function createNotification({
  userId,
  actorId,
  type,
  postId = null
}) {
  const all =
    notifications();

  all.push({
    id: makeId("notification"),
    userId,
    actorId,
    type,
    postId,
    read: false,
    createdAt: now()
  });

  writeJson(
    FILES.notifications,
    all
  );
}

app.get(
  "/api/notifications",
  requireAuth,
  (req, res) => {
    const result =
      notifications()
        .filter(
          (n) =>
            String(n.userId) ===
            String(req.session.userId)
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt) -
            new Date(a.createdAt)
        )
        .map((n) => ({
          ...n,
          actor: safeUser(
            getUserById(
              n.actorId
            ),
            req.session.userId
          )
        }));

    res.json({
      success: true,
      notifications: result
    });
  }
);

app.post(
  "/api/notifications/read",
  requireAuth,
  (req, res) => {
    const all =
      notifications();

    all.forEach((n) => {
      if (
        String(n.userId) ===
        String(req.session.userId)
      ) {
        n.read = true;
      }
    });

    writeJson(
      FILES.notifications,
      all
    );

    res.json({
      success: true
    });
  }
);

/* =========================================================
   MESSAGES
========================================================= */

app.get(
  "/api/messages/conversations",
  requireAuth,
  (req, res) => {
    const all =
      messages();

    const mine =
      all.filter(
        (m) =>
          String(m.senderId) ===
            String(req.session.userId) ||
          String(m.receiverId) ===
            String(req.session.userId)
      );

    const ids = [];

    mine.forEach((m) => {
      const other =
        String(m.senderId) ===
        String(req.session.userId)
          ? m.receiverId
          : m.senderId;

      if (!ids.includes(String(other))) {
        ids.push(String(other));
      }
    });

    const conversations =
      ids.map((id) => {
        const relevant =
          mine
            .filter(
              (m) =>
                String(m.senderId) ===
                  String(id) ||
                String(m.receiverId) ===
                  String(id)
            )
            .sort(
              (a, b) =>
                new Date(b.createdAt) -
                new Date(a.createdAt)
            );

        return {
          user: safeUser(
            getUserById(id),
            req.session.userId
          ),
          lastMessage:
            relevant[0] || null
        };
      });

    res.json({
      success: true,
      conversations
    });
  }
);

app.get(
  "/api/messages/:userId",
  requireAuth,
  (req, res) => {
    const other =
      getUserById(
        req.params.userId
      );

    if (!other) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    const result =
      messages()
        .filter(
          (m) =>
            (
              String(m.senderId) ===
                String(req.session.userId) &&
              String(m.receiverId) ===
                String(other.id)
            ) ||
            (
              String(m.senderId) ===
                String(other.id) &&
              String(m.receiverId) ===
                String(req.session.userId)
            )
        )
        .sort(
          (a, b) =>
            new Date(a.createdAt) -
            new Date(b.createdAt)
        )
        .map((m) => ({
          ...m,
          sender: safeUser(
            getUserById(
              m.senderId
            ),
            req.session.userId
          )
        }));

    res.json({
      success: true,
      user: safeUser(
        other,
        req.session.userId
      ),
      messages: result
    });
  }
);

app.post(
  "/api/messages",
  requireAuth,
  (req, res) => {
    const receiverId =
      req.body.receiverId ||
      req.body.userId;

    const text =
      String(
        req.body.text ||
        req.body.message ||
        ""
      ).trim();

    const receiver =
      getUserById(receiverId);

    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: "Receiver not found."
      });
    }

    if (!text) {
      return res.status(400).json({
        success: false,
        message: "Message is empty."
      });
    }

    const all =
      messages();

    const message = {
      id: makeId("message"),
      senderId:
        req.session.userId,
      receiverId:
        receiver.id,
      text,
      createdAt: now(),
      read: false
    };

    all.push(message);

    writeJson(
      FILES.messages,
      all
    );

    res.json({
      success: true,
      message
    });
  }
);

app.get(
  "/api/messages/unread-count",
  requireAuth,
  (req, res) => {
    const count =
      messages().filter(
        (m) =>
          String(m.receiverId) ===
            String(req.session.userId) &&
          !m.read
      ).length;

    res.json({
      success: true,
      count
    });
  }
);

/* =========================================================
   VERIFICATION
========================================================= */

app.get(
  "/api/verification/me",
  requireAuth,
  (req, res) => {
    const requests =
      verificationRequests();

    const request =
      requests
        .filter(
          (r) =>
            String(r.userId) ===
            String(req.session.userId)
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt) -
            new Date(a.createdAt)
        )[0];

    const user =
      getUserById(
        req.session.userId
      );

    res.json({
      success: true,
      verified: Boolean(
        user?.verified ||
        user?.isVerified
      ),
      status:
        request?.status ||
        user?.verificationStatus ||
        "none",
      request:
        request || null
    });
  }
);

app.post(
  "/api/verification/request",
  requireAuth,
  (req, res) => {
    const all =
      verificationRequests();

    const existing =
      all.find(
        (r) =>
          String(r.userId) ===
            String(req.session.userId) &&
          r.status === "pending"
      );

    if (existing) {
      return res.status(400).json({
        success: false,
        message:
          "You already have a pending verification request."
      });
    }

    const request = {
      id: makeId("verification"),
      userId:
        req.session.userId,
      reason:
        String(
          req.body.reason || ""
        ).trim(),
      status: "pending",
      createdAt: now()
    };

    all.push(request);

    writeJson(
      FILES.verification,
      all
    );

    const allUsers = users();

    const index =
      allUsers.findIndex(
        (u) =>
          String(u.id) ===
          String(req.session.userId)
      );

    if (index >= 0) {
      allUsers[index].verificationStatus =
        "pending";

      writeJson(
        FILES.users,
        allUsers
      );
    }

    res.json({
      success: true,
      request
    });
  }
);

/* =========================================================
   ADMIN
========================================================= */

app.get(
  "/api/admin/me",
  requireAuth,
  requireAdmin,
  (req, res) => {
    res.json({
      success: true,
      admin: true
    });
  }
);

app.get(
  "/api/admin/stats",
  requireAuth,
  requireAdmin,
  (req, res) => {
    res.json({
      success: true,
      stats: {
        users: users().length,
        posts: posts().length,
        comments: comments().length,
        likes: likes().length,
        follows: follows().length,
        messages: messages().length,
        verificationRequests:
          verificationRequests().length
      }
    });
  }
);

app.get(
  "/api/admin/users",
  requireAuth,
  requireAdmin,
  (req, res) => {
    res.json({
      success: true,
      users: users().map((u) =>
        safeUser(
          u,
          req.session.userId
        )
      )
    });
  }
);

app.get(
  "/api/admin/verification/requests",
  requireAuth,
  requireAdmin,
  (req, res) => {
    res.json({
      success: true,
      requests:
        verificationRequests().map(
          (r) => ({
            ...r,
            user: safeUser(
              getUserById(
                r.userId
              ),
              req.session.userId
            )
          })
        )
    });
  }
);

app.post(
  "/api/admin/verification/:id/approve",
  requireAuth,
  requireAdmin,
  (req, res) => {
    const all =
      verificationRequests();

    const index =
      all.findIndex(
        (r) =>
          String(r.id) ===
          String(req.params.id)
      );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message:
          "Verification request not found."
      });
    }

    all[index].status =
      "approved";

    all[index].updatedAt =
      now();

    writeJson(
      FILES.verification,
      all
    );

    const allUsers =
      users();

    const userIndex =
      allUsers.findIndex(
        (u) =>
          String(u.id) ===
          String(all[index].userId)
      );

    if (userIndex >= 0) {
      allUsers[userIndex].verified =
        true;

      allUsers[userIndex].isVerified =
        true;

      allUsers[userIndex].verificationStatus =
        "approved";

      writeJson(
        FILES.users,
        allUsers
      );
    }

    res.json({
      success: true
    });
  }
);

app.post(
  "/api/admin/verification/:id/reject",
  requireAuth,
  requireAdmin,
  (req, res) => {
    const all =
      verificationRequests();

    const index =
      all.findIndex(
        (r) =>
          String(r.id) ===
          String(req.params.id)
      );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message:
          "Verification request not found."
      });
    }

    all[index].status =
      "rejected";

    all[index].updatedAt =
      now();

    writeJson(
      FILES.verification,
      all
    );

    const allUsers =
      users();

    const userIndex =
      allUsers.findIndex(
        (u) =>
          String(u.id) ===
          String(all[index].userId)
      );

    if (userIndex >= 0) {
      allUsers[userIndex].verificationStatus =
        "rejected";

      writeJson(
        FILES.users,
        allUsers
      );
    }

    res.json({
      success: true
    });
  }
);

/* =========================================================
   STORAGE INFO
========================================================= */

app.get(
  "/api/storage-info",
  requireAuth,
  requireAdmin,
  (req, res) => {
    res.json({
      success: true,
      storageRoot: STORAGE_ROOT,
      dataDirectory: DATA_DIR,
      uploadsDirectory:
        UPLOADS_DIR
    });
  }
);

/* =========================================================
   STATIC FILES
========================================================= */

app.use(
  "/uploads",
  express.static(UPLOADS_DIR)
);

app.use(
  express.static(
    path.join(ROOT, "public")
  )
);

/* =========================================================
   SPA / HTML FALLBACK
========================================================= */

app.get("/", (req, res) => {
  res.sendFile(
    path.join(
      ROOT,
      "public",
      "index.html"
    )
  );
});

app.use(
  (req, res, next) => {
    if (
      req.path.startsWith("/api/")
    ) {
      return res.status(404).json({
        success: false,
        message: "API route not found."
      });
    }

    next();
  }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
  (error, req, res, next) => {
    console.error(
      "SERVER ERROR:",
      error
    );

    if (
      error instanceof multer.MulterError
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Upload error: ${error.message}`
      });
    }

    res.status(500).json({
      success: false,
      message:
        error.message ||
        "Internal server error."
    });
  }
);

/* =========================================================
   START
========================================================= */

app.listen(
  PORT,
  HOST,
  () => {
    console.log("");
    console.log(
      "========================================"
    );
    console.log(
      "          PULSE SOCIAL SERVER"
    );
    console.log(
      "========================================"
    );
    console.log(
      `Server: http://${HOST}:${PORT}`
    );
    console.log(
      `Storage: ${STORAGE_ROOT}`
    );
    console.log(
      `Environment: ${
        process.env.NODE_ENV ||
        "development"
      }`
    );
    console.log(
      "Facebook-style social platform ready."
    );
    console.log(
      "========================================"
    );
    console.log("");
  }
);
