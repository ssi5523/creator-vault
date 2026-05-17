export default function PrivacyBanner() {
  return (
    <aside className="privacy-banner" role="note">
      <span className="privacy-icon" aria-hidden>
        🔒
      </span>
      <div>
        <strong>DeFi 本地签名 · 零托管</strong>
        <p>
          授权、兑换、质押、投票均由 TokenCore WASM 在设备内签名；交互记录不上传服务器。
        </p>
      </div>
    </aside>
  );
}
