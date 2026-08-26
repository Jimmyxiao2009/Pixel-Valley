import { useParams } from "react-router-dom";

const ZONE_LABEL: Record<string, string> = {
  plaza: "广场",
  board: "公告栏",
  library: "图书馆",
  cafe: "咖啡馆",
};

export function TownScene() {
  const { zone } = useParams();
  const label = (zone && ZONE_LABEL[zone]) || "镇中心";

  return (
    <section className="feed-scene" aria-label="镇中心">
      <h1 className="font-pixel">镇中心 · {label}</h1>
      <p className="font-body">这里以后是信息流。现在只是空壳。</p>
    </section>
  );
}
