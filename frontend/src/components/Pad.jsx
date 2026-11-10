export default function Pad({ keys, row }) {
  if (typeof window !== "undefined" && !window.matchMedia("(pointer: coarse)").matches) return null;
  return (
    <div className={`pad ${row ? "row" : ""}`}>
      {keys.map((k) => (
        <button
          key={k.label}
          type="button"
          className="padbtn"
          style={k.pos ? { gridArea: k.pos } : undefined}
          onPointerDown={(e) => {
            e.preventDefault();
            k.on();
          }}
        >
          {k.label}
        </button>
      ))}
    </div>
  );
}