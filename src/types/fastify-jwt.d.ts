import '@fastify/jwt';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string;
      email?: string;
      phone?: string;
      name?: string;
      salonId?: string;
      role?: string;
      isAdmin?: boolean;
      isSuperAdmin?: boolean;
      isAgency?: boolean;
      agencyId?: string;
      agencyRole?: string;
      impersonatedBy?: string;
    };
  }
}
