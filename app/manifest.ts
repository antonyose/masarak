import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "مسارك — نتيجة الثانوية وتوقع الكليات",
    short_name: "مسارك",
    description:
      "اعرف نتيجتك واستكشف الكليات الأقرب لمجموعك ومحافظتك بصورة استرشادية.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7fafb",
    theme_color: "#123b56",
    lang: "ar",
    dir: "rtl",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
