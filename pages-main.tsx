import { createRoot } from "react-dom/client";
import { DesertCamelGame } from "@/components/game/DesertCamelGame";
import "@/app/globals.css";

const root = document.getElementById("root");

if (!root) throw new Error("تعذر العثور على عنصر تشغيل اللعبة");

createRoot(root).render(<DesertCamelGame />);
