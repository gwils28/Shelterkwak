// Préférences propres à cet appareil (non synchronisées) : elles ne changent rien aux données du foyer.

import { useState } from "react";

const ANIM_KEY = "shelterkwak.animations";

export function animationsEnabled(): boolean {
  try {
    return localStorage.getItem(ANIM_KEY) !== "off";
  } catch {
    return true;
  }
}

/** Interrupteur des animations du monument, mémorisé sur l'appareil. */
export function useAnimationsPref(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(animationsEnabled);
  const set = (value: boolean) => {
    try {
      localStorage.setItem(ANIM_KEY, value ? "on" : "off");
    } catch {
      // stockage indisponible (navigation privée) : réglage valable pour la session seulement
    }
    setOn(value);
  };
  return [on, set];
}
