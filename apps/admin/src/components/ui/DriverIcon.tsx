const icons = import.meta.glob("../../assets/icons/resources/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const iconByDriver: Record<string, string> = {};
for (const [path, url] of Object.entries(icons)) {
  const name = path.split("/").pop()?.replace(/\.svg$/, "");
  if (name) iconByDriver[name] = url;
}

export function DriverIcon({ driver, size = 16 }: { driver: string; size?: number }) {
  const source = iconByDriver[driver];
  if (!source) return null;
  return (
    <img
      src={source}
      alt=""
      width={size}
      height={size}
      className="driver-icon"
      aria-hidden
    />
  );
}
