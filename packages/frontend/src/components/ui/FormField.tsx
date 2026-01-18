import type { AnyFieldApi } from "@tanstack/react-form";

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
		<div className={className}>
			<label htmlFor={field.name} className="block text-sm font-medium mb-1">
				{label}
			</label>
			{children || (
				<input
					id={field.name}
					name={field.name}
					type={type}
					value={(field.state.value as string) ?? ""}
					onBlur={field.handleBlur}
					onChange={(e) => field.handleChange(e.target.value)}
					className="input w-full"
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
		<p className="text-sm text-red-600 mt-1">
			{errors.map((error) => String(error)).join(", ")}
		</p>
	);
}
