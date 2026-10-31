/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Global & Component-Level Error Boundary — VERTIKAL SMA JAWARA 28
 * Prevents white screen / blank screen crashes and provides a graceful recovery UI.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[220px] p-6 rounded-3xl bg-amber-50 border border-amber-200 shadow-sm flex flex-col items-center justify-center text-center my-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-black text-slate-900 mb-1">
            {this.props.fallbackTitle || 'Tampilan Komponen Terkendala'}
          </h3>
          <p className="text-xs text-slate-600 max-w-md mb-4">
            {this.state.error?.message || 'Terjadi kendala sementara pada modul tampilan ini. Data Anda tetap aman tersimpan.'}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-4 py-2 bg-[#1c5ddc] hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Muat Ulang Komponen
            </button>
            <button
              type="button"
              onClick={this.handleGoHome}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" /> Ke Beranda
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
