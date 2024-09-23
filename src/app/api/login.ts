import jwt from "jsonwebtoken";
import type { NextApiRequest, NextApiResponse } from "next";

import prisma from "@/core/config/db/prisma";

type ResponseData = {
  message: string;
  token?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const email = req.body.email;

  const user = await prisma.user.findUnique({
    where: {
      email: email,
    },
  });

  if (!!user) {
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET as string,
      {
        expiresIn: "1h",
      }
    );

    return res
      .status(200)
      .json({ message: "Login efetuado com sucesso", token });
  }
  return res.status(404).json({ message: "Usuário não encontrado" });
}
