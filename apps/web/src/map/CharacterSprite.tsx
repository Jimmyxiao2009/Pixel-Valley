type CharacterSpriteProps = {
  x: number;
  y: number;
};

export function CharacterSprite({ x, y }: CharacterSpriteProps) {
  return (
    <div className="map-character" style={{ left: x, top: y }} aria-hidden="true">
      <span className="map-character__hat" />
      <span className="map-character__body" />
    </div>
  );
}
