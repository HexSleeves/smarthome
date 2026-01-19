import type { AnyFieldApi } from "@tanstack/react-form";
import { cn } from "@/lib/utils";
import { Input } from "./input";
import { Label } from "./label";

type FormFieldProps = {
	field: AnyFieldApi;
	label: string;
	type?: string;
	placeholder?: string;
	className?: string;
	children?: React.ReactNode;
};

export function FormField({
	field,
	label,
	type = "text",
	placeholder,
	className = "",
	children,
}: FormFieldProps) {
	return (
		<div className={cn("space-y-2", className)}>
			<Label htmlFor={field.name}>{label}</Label>
			{children || (
				<Input
					id={field.name}
					name={field.name}
					type={type}
					value={(field.state.value as string) ?? ""}
					onBlur={field.handleBlur}
					onChange={(e) => field.handleChange(e.target.value)}
					placeholder={placeholder}
				/>
			)}
			<FieldError field={field} />
		</div>
	);
}

export function FieldError({ field }: { field: AnyFieldApi }) {
	const errors =
		field.state.meta.isTouched && field.state.meta.errors.length > 0
			? field.state.meta.errors
			: null;

	if (!errors) return null;

	return (
		<p className="text-sm text-destructive">
			{errors.map((error) => String(error)).join(", ")}
		</p>
	);
}
