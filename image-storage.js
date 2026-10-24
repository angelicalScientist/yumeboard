// Shared Cloudflare R2 image storage helper for Yumeboard.
// Supabase remains responsible for authentication and the database.

const R2_PUBLIC_BASE =
  "https://pub-91e342a0ac42439d8d39d0fc049b867d.r2.dev";

const IMAGE_WORKER_URL =
  "https://yumeboard-image-worker.raizterremoto.workers.dev/";

const ALLOWED_IMAGE_BUCKETS = new Set([
  "profile-images",
  "imageboard-images",
  "gallery",
]);

function getR2ImageUrl(bucket, path) {
  if (!ALLOWED_IMAGE_BUCKETS.has(bucket) || !path) {
    throw new Error("Invalid image bucket or path.");
  }

  const encodedPath = path
    .split("/")
    .map(encodeURIComponent)
    .join("/");

  return `${R2_PUBLIC_BASE}/${bucket}/${encodedPath}`;
}

async function getImageAccessToken(supabaseClient) {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) throw error;

  const token = data?.session?.access_token;

  if (!token) {
    throw new Error("Please sign in before managing images.");
  }

  return token;
}

async function uploadImageToR2(
  supabaseClient,
  bucket,
  path,
  file
) {
  if (!ALLOWED_IMAGE_BUCKETS.has(bucket)) {
    throw new Error("Invalid image bucket.");
  }

  if (!path || !file) {
    throw new Error("An image and storage path are required.");
  }

  if (!file.type || !/^image\/(jpeg|png|webp|gif|avif)$/i.test(file.type)) {
    throw new Error("Unsupported image type.");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Images must be 10 MB or smaller.");
  }

  const token = await getImageAccessToken(supabaseClient);

  const url = new URL(IMAGE_WORKER_URL);
  url.searchParams.set("bucket", bucket);
  url.searchParams.set("path", path);

  const response = await fetch(url.toString(), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": file.type,
    },
    body: file,
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || "Image upload failed.");
  }

  return {
    path,
    url: getR2ImageUrl(bucket, path),
  };
}

async function deleteImageFromR2(
  supabaseClient,
  bucket,
  path
) {
  if (!ALLOWED_IMAGE_BUCKETS.has(bucket)) {
    throw new Error("Invalid image bucket.");
  }

  if (!path) return;

  const token = await getImageAccessToken(supabaseClient);

  const url = new URL(IMAGE_WORKER_URL);
  url.searchParams.set("bucket", bucket);
  url.searchParams.set("path", path);

  const response = await fetch(url.toString(), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || "Image deletion failed.");
  }
}
