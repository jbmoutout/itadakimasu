import Image from "next/image";

interface LoadingOverlayProps {
  logs?: string[];
}

export const LoadingOverlay = ({ logs }: LoadingOverlayProps) => {
  return (
    <div className="mt-4">
      <Image
        src="/images/loading.gif"
        alt="Loading..."
        width={500}
        height={0}
        style={{ width: "500px", height: "auto" }}
      />
      {logs && logs.length > 0 && (
        <div className="bg-gray-900 text-white p-6 mt-4 font-mono text-sm">
          <h3>Server Logs</h3>
          <ul className="mt-2">
            {logs.map((log, index) => (
              <li key={index}>{log}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
