'use client';  // 这是 Next.js 的客户端组件标记

import { useEffect, useState } from 'react';

type RingVerifyResult = {
  valid?: boolean;
  scene?: 'new_ring_binding' | 'daily_access' | 'seal_confirmation';
  uid?: string;
  [key: string]: unknown;
};

export default function StartPage() {
  const [status, setStatus] = useState('正在检查戒指...');
  const [ringData, setRingData] = useState<RingVerifyResult | null>(null);

  useEffect(() => {
    // 获取 URL 中的参数
    const urlParams = new URLSearchParams(window.location.search);
    const picc_data = urlParams.get('picc_data');
    const cmac = urlParams.get('cmac');
    const uid = urlParams.get('uid');
    const ctr = urlParams.get('ctr');
    
    // 如果没有戒指参数，显示普通页面
    if (!picc_data && !uid) {
      const timer = window.setTimeout(() => {
        setStatus('请触碰你的 Haven 戒指');
      }, 0);
      return () => window.clearTimeout(timer);
    }
    
    // 有戒指参数，发送到后端验证
    async function verifyRing() {
      setStatus('正在验证戒指...');
      
      const body = picc_data 
        ? { picc_data, cmac }  // 加密模式
        : { uid, ctr, cmac };   // 明文模式
      
      const response = await fetch('/api/sdm/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      const result = await response.json();
      setRingData(result);
      
      if (!result.valid) {
        setStatus('❌ 戒指无效，请重试');
        return;
      }
      
      // 根据戒指状态跳转不同页面
      if (result.scene === 'new_ring_binding') {
        setStatus('✨ 发现新戒指！正在跳转...');
        setTimeout(() => {
          window.location.href = `/bind-ring?uid=${result.uid}`;
        }, 1500);
      } else if (result.scene === 'daily_access') {
        setStatus('🔓 验证成功，正在打开...');
        setTimeout(() => {
          window.location.href = `/hub`;
        }, 1500);
      } else if (result.scene === 'seal_confirmation') {
        setStatus('🔒 封印确认中...');
        setTimeout(() => {
          window.location.href = `/seal-success`;
        }, 1500);
      }
    }
    
    verifyRing();
  }, []);
  
  return (
    <div style={{ textAlign: 'center', padding: '50px' }}>
      <h1>Haven Ring</h1>
      <p>{status}</p>
      <pre hidden>{ringData ? JSON.stringify(ringData) : ''}</pre>
    </div>
  );
}
