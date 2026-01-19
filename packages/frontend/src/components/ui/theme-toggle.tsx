import { Moon, Sun, Monitor } from "lucide-react";
import { useEffect } from "react";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { useThemeStore, applyTheme } from "@/stores/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
	const { theme, setTheme } = useThemeStore();

	useEffect(() => {
		applyTheme(theme);
	}, [theme]);

	// Listen for system theme changes
	useEffect(() => {
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handleChange = () => {
			if (theme === "system") {
				applyTheme("system");
			}
		};
		mediaQuery.addEventListener("change", handleChange);
		return () => mediaQuery.removeEventListener("change", handleChange);
	}, [theme]);

	const cycleTheme = () => {
		const themes: Array<"light" | "dark" | "system"> = [
			"light",
			"dark",
			"system",
		];
		const currentIndex = themes.indexOf(theme);
		const nextIndex = (currentIndex + 1) % themes.length;
		setTheme(themes[nextIndex]);
	};

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					onClick={cycleTheme}
					className="relative"
				>
					<Sun
						className={cn(
							"h-5 w-5 transition-all",
							theme === "light" ? "scale-100 rotate-0" : "scale-0 -rotate-90",
						)}
					/>
					<Moon
						className={cn(
							"absolute h-5 w-5 transition-all",
							theme === "dark" ? "scale-100 rotate-0" : "scale-0 rotate-90",
						)}
					/>
					<Monitor
						className={cn(
							"absolute h-5 w-5 transition-all",
							theme === "system" ? "scale-100 rotate-0" : "scale-0 rotate-90",
						)}
					/>
					<span className="sr-only">Toggle theme</span>
				</Button>
			</TooltipTrigger>
			<TooltipContent>
				{theme === "light" && "Light mode"}
				{theme === "dark" && "Dark mode"}
				{theme === "system" && "System theme"}
			</TooltipContent>
		</Tooltip>
	);
}
