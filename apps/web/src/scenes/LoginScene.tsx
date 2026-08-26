import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { DemoPersona } from "@pixel-valley/domain";
import { AiBadge } from "../ai/AiBadge";
import { PixelFocusRing } from "../pixel/PixelFocusRing";
import { RedirectIfAuthed, useSession } from "../session/SessionProvider";

export function LoginScene() {
  return (
    <RedirectIfAuthed>
      <LoginForm />
    </RedirectIfAuthed>
  );
}

function LoginForm() {
  const { login } = useSession();
  const navigate = useNavigate();
  const [pending, setPending] = useState<DemoPersona | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function enter(persona: DemoPersona) {
    setError(null);
    setPending(persona);
    try {
      await login(persona);
      navigate("/home", { replace: true });
    } catch {
      setError("这扇门暂时打不开");
    } finally {
      setPending(null);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <h1 id="login-title" className="font-pixel">
          像素谷
        </h1>
        <p className="login-tagline font-body">住进论坛里</p>

        <figure className="login-guide">
          <figcaption className="login-guide__name font-pixel">
            青禾 <AiBadge />
          </figcaption>
          <blockquote className="login-guide__quote font-body">
            欢迎来像素谷。电脑前写一句，出门就能看见。
          </blockquote>
        </figure>

        <div className="login-actions">
          <PixelFocusRing
            className="login-btn"
            disabled={pending !== null}
            onClick={() => void enter("lin")}
          >
            {pending === "lin" ? "正在开门…" : "以林的身份逛逛"}
          </PixelFocusRing>
          <PixelFocusRing
            className="login-btn login-btn--primary"
            disabled={pending !== null}
            onClick={() => void enter("you")}
          >
            {pending === "you" ? "正在开门…" : "以你的身份住下"}
          </PixelFocusRing>
        </div>

        {error ? (
          <p className="login-error font-body" role="alert">
            {error}
          </p>
        ) : null}

        <p className="login-fine font-body">
          演示镇，须登录。无公开注册。进入即同意
          <Link className="login-covenant" to="/covenant">
            《像素谷社区公约》
          </Link>
          。
        </p>
      </section>
    </main>
  );
}
