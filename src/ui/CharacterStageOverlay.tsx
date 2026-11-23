import React, { useState, useEffect } from "react";
import type { CharacterExpression } from "../types/dialogue";

type Props = {
  characterId: string;
  expression?: CharacterExpression;
  isIdentityExposed?: boolean;
  isEntityPresent?: boolean;
};

const CHARACTER_ASSET_PATHS: Record<string, string> = {
  "CHAR-PLAYER": "/assets/characters/player.png",
  "CHAR-PLAYER-DISTORTED": "/assets/characters/player_distorted.png",
  "CHAR-HUNG": "/assets/characters/hung.png",
  "CHAR-MINH": "/assets/characters/minh.png",
  "ENTITY": "/assets/characters/entity.png"
};

export const CharacterStageOverlay: React.FC<Props> = ({
  characterId,
  expression = "neutral",
  isIdentityExposed = false,
  isEntityPresent = false
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [characterId]);

  const targetAssetKey = isIdentityExposed && characterId === "CHAR-PLAYER"
    ? "CHAR-PLAYER-DISTORTED"
    : characterId;

  const assetSrc = CHARACTER_ASSET_PATHS[targetAssetKey];

  if (!assetSrc || imgError) {
    return (
      <div
        className={`stage-actor-badge stage-actor-${characterId.toLowerCase()} expr-${expression} ${
          isIdentityExposed ? "identity-exposed-glow" : ""
        } ${isEntityPresent ? "entity-silhouette" : ""}`}
        aria-hidden="true"
      >
        <div className="actor-badge-inner">
          <span className="actor-code">
            {characterId === "CHAR-HUNG" ? "HÙNG" : characterId === "CHAR-MINH" ? "MINH" : characterId === "ENTITY" ? "THỰC THỂ" : "PLAYER"}
          </span>
          <span className="actor-expr">{expression}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`stage-actor-avatar-wrap ${isIdentityExposed ? "identity-exposed-glow" : ""} ${
        isEntityPresent ? "entity-silhouette" : ""
      }`}
      aria-hidden="true"
    >
      <img
        src={assetSrc}
        alt={characterId}
        className="stage-actor-img"
        onError={() => setImgError(true)}
      />
    </div>
  );
};
