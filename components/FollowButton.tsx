"use client";

import { useState, useTransition } from "react";
import { setFollowAction } from "@/app/actions";

export function FollowButton({ profileId, initialFollowing = false }: { profileId: string; initialFollowing?: boolean }) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const next = !following;
    setFollowing(next);
    startTransition(async () => {
      const result = await setFollowAction({ followeeId: profileId, active: next });
      if (!result.ok) setFollowing(!next);
    });
  }

  return <button className={`button ${following ? "button-quiet" : "button-primary"}`} disabled={pending} onClick={handleClick} type="button">{following ? "Following" : "Follow reviewer"}</button>;
}
