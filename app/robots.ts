import type { MetadataRoute } from "next";

// Sistema de uso interno: nada de esto tiene que aparecer en buscadores — ni
// el login ni los formularios públicos de inscripción, que se comparten por
// link y no tienen por qué ser encontrables.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
