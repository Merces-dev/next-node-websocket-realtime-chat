// pages/api/socket.ts
import prisma from "@/core/config/db/prisma";
import { Server } from "socket.io";
import type { NextApiRequest, NextApiResponse } from "next";

let io: Server;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!res.socket || !res.socket.server) {
    return res.status(500).json({ message: "Socket server is not available." });
  }

  if (!io) {
    io = new Server(res.socket.server);
    res.socket.server.io = io;

    io.on("connection", (socket) => {
      console.log("Novo usuário conectado:", socket.id);

      // Entrar em uma sala ao se conectar (opcional)
      socket.on("joinChat", async ({ chatId }: { chatId: string }) => {
        socket.join(chatId);
        console.log(`Usuário ${socket.id} entrou na sala ${chatId}`);
      });

      // Manipular envio de mensagens
      socket.on(
        "sendMessage",
        async (data: { sender: string; receiver: string; message: string }) => {
          const { sender, receiver, message } = data;

          // Verificar se o receptor existe
          const user = await prisma.user.findUnique({
            where: {
              email: receiver,
            },
          });

          if (!user) {
            socket.emit("messageStatus", { status: "O receptor não existe" });
            return; // Sair se não encontrar o receptor
          }

          // Verificar se existe uma conversa entre o remetente e o receptor
          let chat = await prisma.chat.findFirst({
            where: {
              AND: [
                { users: { some: { id: sender } } },
                { users: { some: { id: user.id } } },
              ],
            },
          });
          if (!chat) {
            chat = await prisma.chat.create({
              data: {
                name: `${sender}-${receiver}`,
                users: { connect: [{ id: sender }, { id: user.id }] },
              },
            });
          }

          // Salvar a mensagem no banco de dados
          const savedMessage = await prisma.message.create({
            data: {
              content: message,
              authorId: sender,
              chatId: chat.id,
            },
          });

          // Emitir a mensagem apenas para a sala correspondente
          io.to(chat.id).emit("receiveMessage", savedMessage);

          // Notificar o remetente que a mensagem foi enviada
          socket.emit("messageStatus", { status: "Mensagem enviada" });
        }
      );

      // Manipular desconexões
      socket.on("disconnect", () => {
        console.log("Usuário desconectado:", socket.id);
      });
    });
  }

  res.end();
}
