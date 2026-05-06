import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAdminSession } from '@/lib/admin-auth';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';

    const whereClause = activeOnly ? 'WHERE is_active = TRUE' : '';

    const [rows] = await pool.execute<
      Array<
        RowDataPacket & {
          id: number;
          code: string;
          name_en: string;
          name_tr: string;
          is_active: boolean;
        }
      >
    >(
      `SELECT id, code, name_en, name_tr, is_active
       FROM countries
       ${whereClause}
       ORDER BY name_en ASC`
    );

    return NextResponse.json({
      success: true,
      data: rows || [],
    });
  } catch (error) {
    console.error('Countries GET error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch countries' } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { code, name_en, name_tr } = body;

    if (!code || !name_en || !name_tr) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'code, name_en, and name_tr are required' } },
        { status: 400 }
      );
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO countries (code, name_en, name_tr, is_active) VALUES (?, ?, ?, TRUE)`,
      [code.toUpperCase().trim(), name_en.trim(), name_tr.trim()]
    );

    return NextResponse.json({
      success: true,
      data: { id: result.insertId, code, name_en, name_tr },
    });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE', message: 'Country code already exists' } },
        { status: 409 }
      );
    }
    console.error('Countries POST error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create country' } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { id, name_en, name_tr, is_active } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } },
        { status: 400 }
      );
    }

    const fields: string[] = [];
    const values: (string | number | boolean)[] = [];

    if (name_en !== undefined) { fields.push('name_en = ?'); values.push(name_en); }
    if (name_tr !== undefined) { fields.push('name_tr = ?'); values.push(name_tr); }
    if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }

    if (fields.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } },
        { status: 400 }
      );
    }

    values.push(id);

    await pool.execute<ResultSetHeader>(
      `UPDATE countries SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Countries PATCH error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update country' } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } },
        { status: 400 }
      );
    }

    await pool.execute<ResultSetHeader>(
      'DELETE FROM countries WHERE id = ?',
      [parseInt(id, 10)]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Countries DELETE error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete country' } },
      { status: 500 }
    );
  }
}
