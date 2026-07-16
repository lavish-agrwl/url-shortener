import { useEffect } from "react";
import { useParams } from "react-router-dom";

const REDIRECT_BASE_URL =
  import.meta.env.VITE_BASE_URL || "https://snaplink.up.railway.app";

export default function RedirectView() {
  const { slug } = useParams<{ slug: string }>();

  useEffect(() => {
    if (!slug) return;

    const redirectUrl = `${REDIRECT_BASE_URL.replace(/\/$/, "")}/${encodeURIComponent(slug)}`;
    window.location.replace(redirectUrl);
  }, [slug]);

  return (
    <div className="flex min-h-32 items-center justify-center text-muted-foreground">
      Redirecting...
    </div>
  );
}
