export interface PendingRegistro {
  channelId: string;
  userId: string;
  nombreEvento: string;
  personal: string;
  aprobados: string;
  suspendidos: string;
  descripcion: string;
  createdAt: number;
}

const pendingRegistros = new Map<string, PendingRegistro>();

export function setPendingRegistro(userId: string, data: PendingRegistro) {
  pendingRegistros.set(userId, data);
}

export function getPendingRegistro(userId: string): PendingRegistro | undefined {
  return pendingRegistros.get(userId);
}

export function deletePendingRegistro(userId: string) {
  pendingRegistros.delete(userId);
}

setInterval(() => {
  const now = Date.now();
  for (const [userId, data] of pendingRegistros.entries()) {
    if (now - data.createdAt > 10 * 60 * 1000) {
      pendingRegistros.delete(userId);
    }
  }
}, 60_000);
