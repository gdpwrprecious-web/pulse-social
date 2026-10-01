/* =========================================================
   PULSE SOCIAL — APP.JS
   Global application logic
========================================================= */

(() => {
  "use strict";

  let currentUser = null;

  /* =======================================================
     INITIALIZE
  ======================================================= */

  document.addEventListener("DOMContentLoaded", async () => {
    setupMobileMenu();
    setupLogout();
    setupGlobalNavigation();
    setupProfileForms();
    setupPostForm();
    setupNotificationBadge();

    await loadCurrentUser();
  });

  /* =======================================================
     CURRENT USER
  ======================================================= */

  async function loadCurrentUser() {
    try {
      const response = await fetch("/api/me", {
        credentials: "include",
        cache: "no-store"
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        return;
      }

      if (!data.loggedIn) {
        currentUser = null;
        updateLoggedOutUI();
        return;
      }

      currentUser = data.user;

      /*
        Make admin status available globally.
      */
      window.currentUser = currentUser;
      window.isAdmin = Boolean(
        data.admin || currentUser.isAdmin
      );

      updateUserUI();
      updateAdminNavigation();
      updateNotificationBadge();

    } catch (error) {
      console.error(
        "Unable to load current user:",
        error
      );
    }
  }

  /* =======================================================
     UPDATE USER UI
  ======================================================= */

  function updateUserUI() {
    if (!currentUser) return;

    const username =
      currentUser.username ||
      "User";

    const displayName =
      currentUser.displayName ||
      currentUser.name ||
      username;

    const profilePicture =
      currentUser.profilePicture ||
      currentUser.avatar ||
      "/images/default-avatar.png";

    /*
      Username elements
    */
    document
      .querySelectorAll("[data-current-username]")
      .forEach((element) => {
        element.textContent = username;
      });

    /*
      Display name elements
    */
    document
      .querySelectorAll("[data-current-name]")
      .forEach((element) => {
        element.textContent = displayName;
      });

    /*
      Profile pictures
    */
    document
      .querySelectorAll("[data-current-avatar]")
      .forEach((element) => {
        element.src = profilePicture;

        element.onerror = () => {
          element.src =
            "/images/default-avatar.png";
        };
      });

    /*
      Profile links
    */
    document
      .querySelectorAll("[data-current-profile]")
      .forEach((element) => {
        element.href =
          `/profile.html?username=${encodeURIComponent(
            username
          )}`;
      });

    /*
      Verified badge
    */
    document
      .querySelectorAll("[data-current-verified]")
      .forEach((element) => {
        element.style.display =
          currentUser.verified
            ? ""
            : "none";
      });

    /*
      Admin-only UI
    */
    document
      .querySelectorAll("[data-admin-only]")
      .forEach((element) => {
        element.style.display =
          window.isAdmin
            ? ""
            : "none";
      });
  }

  /* =======================================================
     LOGGED OUT UI
  ======================================================= */

  function updateLoggedOutUI() {
    document
      .querySelectorAll("[data-authenticated]")
      .forEach((element) => {
        element.style.display = "none";
      });

    document
      .querySelectorAll("[data-logged-out]")
      .forEach((element) => {
        element.style.display = "";
      });
  }

  /* =======================================================
     ADMIN NAVIGATION
  ======================================================= */

  function updateAdminNavigation() {
    const adminLinks =
      document.querySelectorAll(
        "[data-admin-only]"
      );

    adminLinks.forEach((element) => {
      element.style.display =
        window.isAdmin ? "" : "none";
    });
  }

  /* =======================================================
     LOGOUT
  ======================================================= */

  function setupLogout() {
    document.addEventListener(
      "click",
      async (event) => {
        const button =
          event.target.closest(
            "[data-logout], #logoutButton, .logout-button"
          );

        if (!button) return;

        event.preventDefault();

        button.disabled = true;

        try {
          const response = await fetch(
            "/api/logout",
            {
              method: "POST",
              credentials: "include"
            }
          );

          const data =
            await response.json();

          if (!response.ok || !data.success) {
            throw new Error(
              data.message ||
              "Unable to log out."
            );
          }

          currentUser = null;
          window.currentUser = null;

          window.location.href =
            "/login.html";

        } catch (error) {
          console.error(
            "Logout error:",
            error
          );

          alert(
            error.message ||
            "Unable to log out."
          );

          button.disabled = false;
        }
      }
    );
  }

  /* =======================================================
     MOBILE MENU
  ======================================================= */

  function setupMobileMenu() {
    const menuButton =
      document.querySelector(
        "#menuButton, .menu-button, [data-menu-toggle]"
      );

    const mobileMenu =
      document.querySelector(
        "#mobileMenu, .mobile-menu, [data-mobile-menu]"
      );

    if (!menuButton || !mobileMenu) {
      return;
    }

    menuButton.addEventListener(
      "click",
      () => {
        const opened =
          mobileMenu.classList.toggle(
            "open"
          );

        menuButton.classList.toggle(
          "active",
          opened
        );

        menuButton.setAttribute(
          "aria-expanded",
          String(opened)
        );
      }
    );

    /*
      Close mobile menu after clicking a link.
    */
    mobileMenu
      .querySelectorAll("a")
      .forEach((link) => {
        link.addEventListener(
          "click",
          () => {
            mobileMenu.classList.remove(
              "open"
            );

            menuButton.classList.remove(
              "active"
            );

            menuButton.setAttribute(
              "aria-expanded",
              "false"
            );
          }
        );
      });
  }

  /* =======================================================
     GLOBAL NAVIGATION
  ======================================================= */

  function setupGlobalNavigation() {
    document.addEventListener(
      "click",
      (event) => {
        const link =
          event.target.closest(
            "[data-nav]"
          );

        if (!link) return;

        const destination =
          link.dataset.nav;

        if (!destination) return;

        event.preventDefault();

        window.location.href =
          destination;
      }
    );
  }

  /* =======================================================
     PROFILE FORM
  ======================================================= */

  function setupProfileForms() {
    const form =
      document.querySelector(
        "#profileForm"
      );

    if (!form) return;

    form.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        const submitButton =
          form.querySelector(
            "button[type='submit']"
          );

        if (submitButton) {
          submitButton.disabled = true;
        }

        try {
          const formData =
            new FormData(form);

          const body = {
            displayName:
              formData.get(
                "displayName"
              ) || "",

            bio:
              formData.get("bio") || ""
          };

          const response =
            await fetch(
              "/api/profile",
              {
                method: "PUT",
                headers: {
                  "Content-Type":
                    "application/json"
                },
                credentials: "include",
                body: JSON.stringify(body)
              }
            );

          const data =
            await response.json();

          if (
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              data.message ||
              "Unable to update profile."
            );
          }

          if (data.user) {
            currentUser =
              data.user;

            window.currentUser =
              currentUser;

            updateUserUI();
          }

          showMessage(
            "Profile updated successfully.",
            "success"
          );

        } catch (error) {
          console.error(
            "Profile update error:",
            error
          );

          showMessage(
            error.message ||
            "Unable to update profile.",
            "error"
          );

        } finally {
          if (submitButton) {
            submitButton.disabled =
              false;
          }
        }
      }
    );

    setupProfilePictureUpload();
  }

  /* =======================================================
     PROFILE PICTURE
  ======================================================= */

  function setupProfilePictureUpload() {
    const input =
      document.querySelector(
        "#profilePicture"
      );

    const form =
      document.querySelector(
        "#profilePictureForm"
      );

    if (!input || !form) return;

    form.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        if (!input.files.length) {
          showMessage(
            "Please select an image.",
            "error"
          );

          return;
        }

        const button =
          form.querySelector(
            "button[type='submit']"
          );

        if (button) {
          button.disabled = true;
        }

        try {
          const formData =
            new FormData();

          formData.append(
            "profilePicture",
            input.files[0]
          );

          const response =
            await fetch(
              "/api/profile/picture",
              {
                method: "POST",
                credentials: "include",
                body: formData
              }
            );

          const data =
            await response.json();

          if (
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              data.message ||
              "Unable to upload profile picture."
            );
          }

          if (data.user) {
            currentUser =
              data.user;

            window.currentUser =
              currentUser;

            updateUserUI();
          }

          showMessage(
            "Profile picture updated.",
            "success"
          );

          input.value = "";

        } catch (error) {
          console.error(
            "Profile picture error:",
            error
          );

          showMessage(
            error.message ||
            "Unable to upload profile picture.",
            "error"
          );

        } finally {
          if (button) {
            button.disabled = false;
          }
        }
      }
    );
  }

  /* =======================================================
     CREATE POST
  ======================================================= */

  function setupPostForm() {
    const form =
      document.querySelector(
        "#postForm"
      );

    if (!form) return;

    const textInput =
      form.querySelector(
        "textarea[name='text'], textarea[name='content'], textarea"
      );

    const imageInput =
      form.querySelector(
        "input[type='file']"
      );

    const preview =
      form.querySelector(
        "#postImagePreview, .post-image-preview"
      );

    if (imageInput && preview) {
      imageInput.addEventListener(
        "change",
        () => {
          preview.innerHTML = "";

          const file =
            imageInput.files[0];

          if (!file) {
            preview.style.display =
              "none";

            return;
          }

          if (
            !file.type.startsWith(
              "image/"
            )
          ) {
            showMessage(
              "Please select an image file.",
              "error"
            );

            imageInput.value = "";

            return;
          }

          const image =
            document.createElement(
              "img"
            );

          image.src =
            URL.createObjectURL(
              file
            );

          image.className =
            "post-preview-image";

          preview.appendChild(
            image
          );

          preview.style.display =
            "block";
        }
      );
    }

    form.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        const submitButton =
          form.querySelector(
            "button[type='submit']"
          );

        if (submitButton) {
          submitButton.disabled =
            true;

          submitButton.dataset.originalText =
            submitButton.textContent;

          submitButton.textContent =
            "Posting...";
        }

        try {
          const formData =
            new FormData();

          const text =
            textInput
              ? textInput.value.trim()
              : "";

          if (text) {
            formData.append(
              "text",
              text
            );
          }

          if (
            imageInput &&
            imageInput.files.length
          ) {
            formData.append(
              "image",
              imageInput.files[0]
            );
          }

          if (
            !text &&
            !(
              imageInput &&
              imageInput.files.length
            )
          ) {
            throw new Error(
              "Write something or select an image."
            );
          }

          const response =
            await fetch(
              "/api/posts",
              {
                method: "POST",
                credentials: "include",
                body: formData
              }
            );

          const data =
            await response.json();

          if (
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              data.message ||
              "Unable to create post."
            );
          }

          /*
            Clear form.
          */
          form.reset();

          if (preview) {
            preview.innerHTML = "";
            preview.style.display =
              "none";
          }

          showMessage(
            "Post published!",
            "success"
          );

          /*
            Reload upgraded feed.
          */
          if (
            typeof window.loadFeed ===
            "function"
          ) {
            await window.loadFeed(
              true
            );
          } else {
            /*
              If feed.js hasn't loaded,
              reload the page.
            */
            if (
              window.location.pathname
                .includes("feed.html")
            ) {
              window.location.reload();
            }
          }

        } catch (error) {
          console.error(
            "Create post error:",
            error
          );

          showMessage(
            error.message ||
            "Unable to create post.",
            "error"
          );

        } finally {
          if (submitButton) {
            submitButton.disabled =
              false;

            submitButton.textContent =
              submitButton.dataset
                .originalText ||
              "Post";
          }
        }
      }
    );
  }

  /* =======================================================
     NOTIFICATIONS
  ======================================================= */

  function setupNotificationBadge() {
    /*
      Initial notification count.
    */
    updateNotificationBadge();

    /*
      Refresh every 30 seconds.
    */
    setInterval(
      updateNotificationBadge,
      30000
    );
  }

  async function updateNotificationBadge() {
    try {
      const response =
        await fetch(
          "/api/notifications",
          {
            credentials: "include",
            cache: "no-store"
          }
        );

      if (!response.ok) return;

      const data =
        await response.json();

      if (!data.success) return;

      const notifications =
        Array.isArray(
          data.notifications
        )
          ? data.notifications
          : [];

      const unread =
        notifications.filter(
          (notification) =>
            !notification.read &&
            !notification.readAt
        ).length;

      document
        .querySelectorAll(
          "[data-notification-count], #notificationCount"
        )
        .forEach((element) => {
          element.textContent =
            String(unread);

          element.style.display =
            unread > 0
              ? ""
              : "none";
        });

    } catch (error) {
      /*
        Notification failure should never
        break the rest of the application.
      */
      console.debug(
        "Notification refresh failed:",
        error
      );
    }
  }

  /* =======================================================
     MESSAGE UNREAD COUNT
  ======================================================= */

  async function updateMessageBadge() {
    try {
      const response =
        await fetch(
          "/api/messages/unread-count",
          {
            credentials: "include",
            cache: "no-store"
          }
        );

      if (!response.ok) return;

      const data =
        await response.json();

      if (!data.success) return;

      const count =
        Number(
          data.count ||
          data.unreadCount ||
          0
        );

      document
        .querySelectorAll(
          "[data-message-count], #messageCount"
        )
        .forEach((element) => {
          element.textContent =
            String(count);

          element.style.display =
            count > 0
              ? ""
              : "none";
        });

    } catch (error) {
      console.debug(
        "Message count failed:",
        error
      );
    }
  }

  /* =======================================================
     GLOBAL REFRESH
  ======================================================= */

  setInterval(
    updateMessageBadge,
    30000
  );

  /* =======================================================
     SHOW MESSAGE
  ======================================================= */

  function showMessage(
    message,
    type = "info"
  ) {
    let container =
      document.getElementById(
        "appMessage"
      );

    if (!container) {
      container =
        document.createElement(
          "div"
        );

      container.id =
        "appMessage";

      container.className =
        "app-message";

      document.body.appendChild(
        container
      );
    }

    container.className =
      `app-message ${type}`;

    container.textContent =
      message;

    container.style.display =
      "block";

    clearTimeout(
      container._hideTimer
    );

    container._hideTimer =
      setTimeout(() => {
        container.style.display =
          "none";
      }, 3500);
  }

  /* =======================================================
     ESCAPE HELPERS
  ======================================================= */

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );
  }

  /* =======================================================
     PUBLIC API
  ======================================================= */

  window.PulseApp = {
    getCurrentUser() {
      return currentUser;
    },

    refreshUser() {
      return loadCurrentUser();
    },

    showMessage,

    updateNotificationBadge,

    updateMessageBadge
  };

  /*
    Make these available to other scripts.
  */
  window.loadCurrentUser =
    loadCurrentUser;

  window.showMessage =
    showMessage;

})();