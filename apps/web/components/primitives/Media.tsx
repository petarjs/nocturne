"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { useMotionPrefs } from "@/lib/motion-prefs";
import { EmptyState } from "@/components/primitives/EmptyState";

type SharedProps = {
  alt: string;
  className?: string;
  fit?: "cover" | "contain";
};

function Poster({ src, alt, fit = "cover", className = "" }: SharedProps & { src: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return <EmptyState message="Media unavailable" />;

  return (
    // Sources are agent-authored and may be on any host, so Next Image's
    // build-time host allowlist is intentionally not the right contract here.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`h-full w-full ${fit === "cover" ? "object-cover" : "object-contain"} ${className}`}
      onError={() => setFailedSrc(src)}
      draggable={false}
      referrerPolicy="no-referrer"
    />
  );
}

export function ImageMedia({
  src,
  alt,
  fit = "cover",
  kenBurns = false,
  className = "",
}: SharedProps & { src: string; kenBurns?: boolean }) {
  const { reducedMotion } = useMotionPrefs();
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return <EmptyState message="Image unavailable" />;

  return (
    <motion.div
      className={`h-full w-full ${className}`}
      animate={kenBurns && !reducedMotion ? { scale: [1, 1.055], x: [0, -6], y: [0, 4] } : { scale: 1 }}
      transition={{ duration: 40, repeat: Infinity, repeatType: "mirror", ease: "linear" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={`h-full w-full ${fit === "cover" ? "object-cover" : "object-contain"}`}
        onError={() => setFailedSrc(src)}
        draggable={false}
        referrerPolicy="no-referrer"
      />
    </motion.div>
  );
}

export function VideoMedia({
  src,
  poster,
  alt,
  loop,
  className = "",
}: SharedProps & { src: string; poster: string; loop: boolean }) {
  const { tier, reducedMotion } = useMotionPrefs();
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showPoster = tier < 3 || reducedMotion || !src || failedSrc === src;

  if (showPoster) {
    return <Poster src={poster} alt={`${alt} poster`} className={className} />;
  }

  return (
    <video
      className={`h-full w-full object-cover ${className}`}
      autoPlay
      muted
      playsInline
      loop={loop}
      poster={poster}
      preload="metadata"
      aria-label={alt}
      onError={() => setFailedSrc(src)}
    >
      <source src={src} />
      Your browser does not support the video element.
    </video>
  );
}
