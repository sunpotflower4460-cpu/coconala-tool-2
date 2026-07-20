import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 個人情報を含む可能性があるためスタック詳細はコンソールに出さず、種別のみ記録する。
    console.error(
      "画面の描画中にエラーが発生しました",
      error.name,
      info.componentStack ? "with-stack" : "no-stack",
    );
  }

  private handleReload = (): void => {
    this.setState({ error: null });
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div role="alert" style={{ padding: "2rem", textAlign: "center" }}>
          <h1>予期しないエラーが発生しました</h1>
          <p>作業中のデータは失われていない可能性があります。アプリを再読み込みしてください。</p>
          <button type="button" onClick={this.handleReload}>
            再読み込みする
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
