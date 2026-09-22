const supabaseClient = window.supabaseClient;

let currentUser = null;
let notificationRefreshInterval = null;

document.addEventListener("DOMContentLoaded", loadFriendsPage);


/* =========================================
   PAGE LOAD
========================================= */

async function loadFriendsPage() {
  const status = document.getElementById("friendsStatus");

  try {
    if (!supabaseClient) {
      throw new Error("Supabase client is not available.");
    }

    const {
      data: { user },
      error: authError
    } = await supabaseClient.auth.getUser();

    if (authError) {
      throw authError;
    }

    if (!user) {
      window.location.href = "index.html";
      return;
    }

    currentUser = user;

    await Promise.all([
      loadFriends(),
      loadFriendRequests(),
      loadNotifications()
    ]);

    if (status) {
      status.textContent =
        "Your friends, friend requests & notifications ♡";
    }

    /*
     * Refresh notifications periodically while the page
     * is open so new artwork posts appear without needing
     * a manual page refresh.
     */
    startNotificationRefresh();

  } catch (error) {
    console.error("Error loading friends page:", error);

    if (status) {
      status.textContent =
        "Something went wrong loading your friends. :(";
    }
  }
}


/* =========================================
   FRIENDS
========================================= */

async function loadFriends() {
  const container =
    document.getElementById("friendsList");

  if (!container) {
    console.error("Could not find #friendsList.");
    return;
  }

  const {
    data: friendships,
    error
  } = await supabaseClient
    .from("friendships")
    .select(`
      id,
      requester_id,
      addressee_id,
      created_at
    `)
    .eq("status", "accepted")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(
      "Error loading friendships:",
      error
    );

    container.innerHTML =
      "<p>Could not load your friends. :(</p>";

    return;
  }

  if (!friendships || friendships.length === 0) {
    container.innerHTML = `
      <p>You don't have any friends yet! 🌸</p>
    `;

    return;
  }

  /*
   * Find the other person in every friendship.
   */
  const friendIds = friendships.map(friendship => {
    return String(friendship.requester_id) ===
      String(currentUser.id)
      ? friendship.addressee_id
      : friendship.requester_id;
  });

  const {
    data: profiles,
    error: profileError
  } = await supabaseClient
    .from("profiles")
    .select("id, username, display_name")
    .in("id", friendIds);

  if (profileError) {
    console.error(
      "Error loading friend profiles:",
      profileError
    );

    container.innerHTML =
      "<p>Could not load friend profiles. :(</p>";

    return;
  }

  if (!profiles || profiles.length === 0) {
    container.innerHTML =
      "<p>No friend profiles found.</p>";

    return;
  }

  const profileMap = new Map(
    profiles.map(profile => [
      String(profile.id),
      profile
    ])
  );

  container.innerHTML = "";

  friendIds.forEach(friendId => {
    const profile =
      profileMap.get(String(friendId));

    if (!profile) {
      console.warn(
        "Could not find profile for friend:",
        friendId
      );

      return;
    }

    const friendCard =
      document.createElement("div");

    friendCard.className = "friend-card";

    const displayName =
      profile.display_name ||
      profile.username ||
      "Unknown User";

    const username =
      profile.username ||
      "unknown";

    /*
     * Friend information
     */
    const friendInfo =
      document.createElement("div");

    friendInfo.className = "friend-info";

    friendInfo.innerHTML = `
      <strong>${escapeHtml(displayName)}</strong>
      <span>@${escapeHtml(username)}</span>
    `;

    /*
     * Visit profile
     */
    const visitButton =
      document.createElement("button");

    visitButton.type = "button";
    visitButton.textContent =
      "♡ Visit Profile";

    visitButton.addEventListener("click", () => {
      window.location.href =
        `users-profile.html?id=${encodeURIComponent(profile.id)}`;
    });

    friendCard.appendChild(friendInfo);
    friendCard.appendChild(visitButton);

    container.appendChild(friendCard);
  });
}


/* =========================================
   FRIEND REQUESTS
========================================= */

async function loadFriendRequests() {
  const container =
    document.getElementById("friendRequests");

  if (!container) {
    console.error("Could not find #friendRequests.");
    return;
  }

  const {
    data: requests,
    error
  } = await supabaseClient
    .from("friendships")
    .select(`
      id,
      requester_id,
      addressee_id,
      created_at
    `)
    .eq("status", "pending")
    .eq("addressee_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(
      "Error loading friend requests:",
      error
    );

    container.innerHTML =
      "<p>Could not load friend requests. :(</p>";

    return;
  }

  if (!requests || requests.length === 0) {
    container.innerHTML = `
      <p>No pending friend requests! 🌸</p>
    `;

    return;
  }

  const requesterIds = requests.map(
    request => request.requester_id
  );

  const {
    data: profiles,
    error: profileError
  } = await supabaseClient
    .from("profiles")
    .select("id, username, display_name")
    .in("id", requesterIds);

  if (profileError) {
    console.error(
      "Error loading requester profiles:",
      profileError
    );

    container.innerHTML =
      "<p>Could not load friend requests. :(</p>";

    return;
  }

  const profileMap = new Map(
    (profiles || []).map(profile => [
      String(profile.id),
      profile
    ])
  );

  container.innerHTML = "";

  requests.forEach(request => {
    const profile =
      profileMap.get(
        String(request.requester_id)
      );

    if (!profile) {
      console.warn(
        "Could not find requester profile:",
        request.requester_id
      );

      return;
    }

    const displayName =
      profile.display_name ||
      profile.username ||
      "Unknown User";

    const username =
      profile.username ||
      "unknown";

    const requestCard =
      document.createElement("div");

    requestCard.className =
      "friend-request-card";

    /*
     * Requester information
     */
    const friendInfo =
      document.createElement("div");

    friendInfo.className =
      "friend-info";

    friendInfo.innerHTML = `
      <strong>${escapeHtml(displayName)}</strong>
      <span>@${escapeHtml(username)}</span>
    `;

    /*
     * View profile
     */
    const profileButton =
      document.createElement("button");

    profileButton.type = "button";
    profileButton.textContent =
      "♡ View Profile";

    profileButton.addEventListener("click", () => {
      window.location.href =
        `users-profile.html?id=${encodeURIComponent(profile.id)}`;
    });

    /*
     * Request actions
     */
    const actions =
      document.createElement("div");

    actions.className =
      "friend-request-actions";

    const acceptButton =
      document.createElement("button");

    acceptButton.type = "button";
    acceptButton.className =
      "accept-button";

    acceptButton.textContent =
      "Accept";

    const declineButton =
      document.createElement("button");

    declineButton.type = "button";
    declineButton.className =
      "decline-button";

    declineButton.textContent =
      "Decline";

    /*
     * Accept
     */
    acceptButton.addEventListener(
      "click",
      async () => {
        acceptButton.disabled = true;
        declineButton.disabled = true;

        await acceptFriendRequest(request.id);
      }
    );

    /*
     * Decline
     */
    declineButton.addEventListener(
      "click",
      async () => {
        acceptButton.disabled = true;
        declineButton.disabled = true;

        await declineFriendRequest(request.id);
      }
    );

    actions.appendChild(acceptButton);
    actions.appendChild(declineButton);

    requestCard.appendChild(friendInfo);
    requestCard.appendChild(profileButton);
    requestCard.appendChild(actions);

    container.appendChild(requestCard);
  });
}


/* =========================================
   NOTIFICATIONS
========================================= */

async function loadNotifications() {
  const container =
    document.getElementById("friendNotifications");

  const countElement =
    document.getElementById("notificationCount");

  if (!container) {
    console.error(
      "Could not find #friendNotifications."
    );

    return;
  }

  const {
    data: notifications,
    error
  } = await supabaseClient
    .from("friend_notifications")
    .select(`
      id,
      user_id,
      friend_id,
      gallery_item_id,
      created_at,
      is_read
    `)
    .eq("user_id", currentUser.id)
    .order("created_at", {
      ascending: false
    });

  if (error) {
    console.error(
      "Error loading notifications:",
      error
    );

    container.innerHTML =
      "<p>Could not load notifications. :(</p>";

    if (countElement) {
      countElement.textContent = "";
    }

    return;
  }

  if (!notifications || notifications.length === 0) {
    container.innerHTML = `
      <p>No notifications yet! 🌸</p>
    `;

    if (countElement) {
      countElement.textContent = "";
    }

    return;
  }

  /*
   * Count unread notifications.
   */
  const unreadCount =
    notifications.filter(
      notification => !notification.is_read
    ).length;

  if (countElement) {
    countElement.textContent =
      unreadCount > 0
        ? `♡ ${unreadCount} unread`
        : "♡ All caught up!";
  }

  /*
   * Collect friend IDs and artwork IDs.
   */
  const friendIds = [
    ...new Set(
      notifications.map(
        notification => notification.friend_id
      )
    )
  ];

  const galleryItemIds = [
    ...new Set(
      notifications.map(
        notification => notification.gallery_item_id
      )
    )
  ];

  /*
   * Load friend profiles.
   */
  const {
    data: profiles,
    error: profileError
  } = await supabaseClient
    .from("profiles")
    .select("id, username, display_name")
    .in("id", friendIds);

  if (profileError) {
    console.error(
      "Error loading notification profiles:",
      profileError
    );
  }

  /*
   * Load artwork information.
   *
   * gallery_items is already protected by its
   * RLS rules, so only artwork the current user
   * is allowed to see will be returned.
   */
  const {
    data: galleryItems,
    error: galleryError
  } = await supabaseClient
    .from("gallery_items")
    .select(`
      id,
      user_id,
      title,
      description,
      image_url,
      created_at
    `)
    .in("id", galleryItemIds);

  if (galleryError) {
    console.error(
      "Error loading notification artwork:",
      galleryError
    );
  }

  const profileMap = new Map(
    (profiles || []).map(profile => [
      String(profile.id),
      profile
    ])
  );

  const galleryMap = new Map(
    (galleryItems || []).map(item => [
      String(item.id),
      item
    ])
  );

  container.innerHTML = "";

  notifications.forEach(notification => {
    const profile =
      profileMap.get(
        String(notification.friend_id)
      );

    const artwork =
      galleryMap.get(
        String(notification.gallery_item_id)
      );

    /*
     * If the related artwork disappeared somehow,
     * don't render a broken notification.
     */
    if (!artwork) {
      return;
    }

    const displayName =
      profile?.display_name ||
      profile?.username ||
      "A friend";

    const username =
      profile?.username ||
      "friend";

    const notificationCard =
      document.createElement("div");

    notificationCard.className =
      "friend-notification-card";

    /*
     * Give unread notifications an extra class.
     */
    if (!notification.is_read) {
      notificationCard.classList.add(
        "unread"
      );
    }

    /*
     * Notification text
     */
    const notificationText =
      document.createElement("div");

    notificationText.className =
      "friend-notification-info";

    const title =
      artwork.title ||
      "a new artwork";

    notificationText.innerHTML = `
      <strong>
        ♡ @${escapeHtml(username)}
        posted ${escapeHtml(title)}!
      </strong>

      <span>
        ${escapeHtml(displayName)}
      </span>
    `;

    /*
     * View gallery button
     */
    const viewButton =
      document.createElement("button");

    viewButton.type = "button";

    viewButton.textContent =
      "♡ View Gallery";

    viewButton.addEventListener(
      "click",
      async () => {
        /*
         * Mark notification as read first.
         */
        await markNotificationAsRead(
          notification.id
        );

        /*
         * Then visit the friend's gallery.
         */
        window.location.href =
          `gallery.html?user=${encodeURIComponent(notification.friend_id)}`;
      }
    );

    notificationCard.appendChild(
      notificationText
    );

    notificationCard.appendChild(
      viewButton
    );

    container.appendChild(
      notificationCard
    );
  });

  /*
   * All notifications may have been filtered out
   * because their artwork no longer exists.
   */
  if (!container.children.length) {
    container.innerHTML = `
      <p>No notifications to display! 🌸</p>
    `;
  }
}


/* =========================================
   MARK NOTIFICATION AS READ
========================================= */

async function markNotificationAsRead(
  notificationId
) {
  const { error } =
    await supabaseClient
      .from("friend_notifications")
      .update({
        is_read: true
      })
      .eq("id", notificationId)
      .eq("user_id", currentUser.id);

  if (error) {
    console.error(
      "Error marking notification as read:",
      error
    );

    return false;
  }

  return true;
}


/* =========================================
   NOTIFICATION REFRESH
========================================= */

function startNotificationRefresh() {
  /*
   * Prevent duplicate intervals if the function
   * somehow gets called more than once.
   */
  if (notificationRefreshInterval) {
    clearInterval(
      notificationRefreshInterval
    );
  }

  /*
   * Refresh every 30 seconds.
   */
  notificationRefreshInterval =
    setInterval(() => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        loadNotifications();
      }
    }, 30000);
}


/*
 * Refresh when the user returns to the tab.
 */
document.addEventListener(
  "visibilitychange",
  () => {
    if (
      document.visibilityState === "visible" &&
      currentUser
    ) {
      loadNotifications();
    }
  }
);


/* =========================================
   ACCEPT FRIEND REQUEST
========================================= */

async function acceptFriendRequest(
  friendshipId
) {
  const { error } =
    await supabaseClient.rpc(
      "accept_friend_request",
      {
        friendship_id: friendshipId
      }
    );

  if (error) {
    console.error(
      "Error accepting friend request:",
      error
    );

    alert(
      "Could not accept the friend request. :("
    );

    await loadFriendRequests();

    return;
  }

  /*
   * Refresh both sections.
   */
  await Promise.all([
    loadFriends(),
    loadFriendRequests()
  ]);
}


/* =========================================
   DECLINE FRIEND REQUEST
========================================= */

async function declineFriendRequest(
  friendshipId
) {
  const { error } =
    await supabaseClient.rpc(
      "decline_friend_request",
      {
        friendship_id: friendshipId
      }
    );

  if (error) {
    console.error(
      "Error declining friend request:",
      error
    );

    alert(
      "Could not decline the friend request. :("
    );

    await loadFriendRequests();

    return;
  }

  await loadFriendRequests();
}


/* =========================================
   HTML ESCAPING
========================================= */

function escapeHtml(value) {
  const div =
    document.createElement("div");

  div.textContent = value ?? "";

  return div.innerHTML;
}