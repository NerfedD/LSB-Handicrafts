import { describe, expect, it, vi } from 'vitest';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { rpc } }));
import { createOrderCommandRunner, orderCommand } from './orderCommand';

describe('retrying an order action', () => {
  it('reuses the original payload and key despite regenerated refund timestamps', async () => {
    const send = vi.fn().mockResolvedValueOnce({ ok: false, retryable: true }).mockResolvedValue({ ok: true });
    const runner = createOrderCommandRunner(send);
    const data = { orderId: 1, expectedRevision: 0, order: { refundHistory: [{ id: 100, refundedAt: 'first', amount: 50 }] } };
    await runner.run('refund', data);
    await runner.run('refund', { ...data, order: { refundHistory: [{ id: 101, refundedAt: 'later', amount: 50 }] } });
    expect(send.mock.calls[1]).toEqual(send.mock.calls[0]);
  });

  it('uses a new key for an edited amount or a known rejection', async () => {
    const send = vi.fn().mockResolvedValue({ ok: false, retryable: true });
    const runner = createOrderCommandRunner(send);
    await runner.run('refund', { orderId: 1, order: { refundedAmount: 50 } });
    await runner.run('refund', { orderId: 1, order: { refundedAmount: 60 } });
    expect(send.mock.calls[1][2]).not.toBe(send.mock.calls[0][2]);
    send.mockResolvedValue({ ok: false, retryable: false });
    await runner.run('refund', { orderId: 1, order: { refundedAmount: 60 } });
    await runner.run('refund', { orderId: 1, order: { refundedAmount: 60 } });
    expect(send.mock.calls[3][2]).not.toBe(send.mock.calls[2][2]);
  });

  it('does not let a double click submit a second action', async () => {
    let release;
    const send = vi.fn(() => new Promise((resolve) => { release = resolve; }));
    const runner = createOrderCommandRunner(send);
    const first = runner.run('complete', { orderId: 1 });
    expect((await runner.run('complete', { orderId: 1 })).ok).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
    release({ ok: true });
    await first;
  });

  it('does not promise that a lost response means nothing was saved', async () => {
    rpc.mockRejectedValueOnce(new Error('connection lost'));
    const result = await orderCommand('refund', {}, 'request');
    expect(result.retryable).toBe(true);
    expect(result.message).toMatch(/could not be confirmed/);
  });
});
