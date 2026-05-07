// app/api/sdm/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';

// 从环境变量读取 sdm-backend 地址
const SDM_BACKEND_URL = process.env.SDM_BACKEND_URL || 'http://localhost:8080';

export async function POST(request: NextRequest) {
  try {
    // 1. 接收前端传来的戒指数据
    const body = await request.json();
    const { picc_data, cmac, uid, ctr } = body;
    
    // 2. 判断是加密模式还是明文模式
    let verifyBody = {};
    if (picc_data && cmac) {
      // 加密模式（推荐）
      verifyBody = { picc_data, cmac };
    } else if (uid && ctr && cmac) {
      // 明文模式（调试用）
      verifyBody = { uid, ctr, cmac };
    } else {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // 3. 调用 sdm-backend 验证
    const response = await fetch(`${SDM_BACKEND_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(verifyBody),
    });
    
    const result = await response.json();
    
    // 4. 返回验证结果给前端
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('SDM verify error:', error);
    return NextResponse.json(
      { error: 'Internal server error', valid: false },
      { status: 500 }
    );
  }
}
