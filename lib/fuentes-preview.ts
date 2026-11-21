// Fuentes de los estilos de preview (ver lib/estilos-preview.ts). Sin
// preload: el navegador solo descarga la que use el estilo activo, y las
// clases de variable solo se agregan a <html> cuando el selector está activo.
import {
  Caveat,
  Nunito,
  Orbitron,
  Patrick_Hand,
  Playfair_Display,
  Press_Start_2P,
  Righteous,
  Rubik,
  Space_Grotesk,
  Space_Mono,
  VT323,
} from "next/font/google";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-e-space-grotesk", preload: false });
const spaceMono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-e-space-mono", preload: false });
const rubik = Rubik({ subsets: ["latin"], variable: "--font-e-rubik", preload: false });
const orbitron = Orbitron({ subsets: ["latin"], variable: "--font-e-orbitron", preload: false });
const righteous = Righteous({ subsets: ["latin"], weight: "400", variable: "--font-e-righteous", preload: false });
const pressStart = Press_Start_2P({ subsets: ["latin"], weight: "400", variable: "--font-e-press-start", preload: false });
const vt323 = VT323({ subsets: ["latin"], weight: "400", variable: "--font-e-vt323", preload: false });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-e-nunito", preload: false });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-e-playfair", preload: false });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-e-caveat", preload: false });
const patrickHand = Patrick_Hand({ subsets: ["latin"], weight: "400", variable: "--font-e-patrick-hand", preload: false });

export const clasesFuentesPreview = [
  spaceGrotesk,
  spaceMono,
  rubik,
  orbitron,
  righteous,
  pressStart,
  vt323,
  nunito,
  playfair,
  caveat,
  patrickHand,
]
  .map((f) => f.variable)
  .join(" ");
