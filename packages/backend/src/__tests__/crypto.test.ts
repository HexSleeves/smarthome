import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "../lib/crypto.js";

describe("crypto", () => {
	describe("encrypt/decrypt", () => {
		it("encrypts and decrypts data correctly", () => {
			const secret = "test-secret-key-12345";
			const plaintext = "sensitive data here";

			const encrypted = encrypt(plaintext, secret);
			const decrypted = decrypt(encrypted, secret);

			expect(decrypted).toBe(plaintext);
		});

		it("produces different ciphertext for same input (due to random IV/salt)", () => {
			const secret = "test-secret-key-12345";
			const plaintext = "sensitive data here";

			const encrypted1 = encrypt(plaintext, secret);
			const encrypted2 = encrypt(plaintext, secret);

			expect(encrypted1).not.toBe(encrypted2);
		});

		it("handles unicode and special characters", () => {
			const secret = "test-secret";
			const plaintext = "Hello 世界 🌍 émojis & spëcial chars!";

			const encrypted = encrypt(plaintext, secret);
			const decrypted = decrypt(encrypted, secret);

			expect(decrypted).toBe(plaintext);
		});

		it("handles empty string", () => {
			const secret = "test-secret";
			const plaintext = "";

			const encrypted = encrypt(plaintext, secret);
			const decrypted = decrypt(encrypted, secret);

			expect(decrypted).toBe(plaintext);
		});

		it("handles large data", () => {
			const secret = "test-secret";
			const plaintext = "a".repeat(10000);

			const encrypted = encrypt(plaintext, secret);
			const decrypted = decrypt(encrypted, secret);

			expect(decrypted).toBe(plaintext);
		});
	});

	describe("decryption failures", () => {
		it("fails with wrong secret", () => {
			const plaintext = "sensitive data";
			const encrypted = encrypt(plaintext, "correct-secret");

			expect(() => decrypt(encrypted, "wrong-secret")).toThrow();
		});

		it("fails with tampered ciphertext", () => {
			const secret = "test-secret";
			const encrypted = encrypt("data", secret);

			// Tamper with the encrypted part
			const parts = encrypted.split(":");
			parts[3] = `tampered${parts[3].slice(8)}`;
			const tampered = parts.join(":");

			expect(() => decrypt(tampered, secret)).toThrow();
		});

		it("fails with malformed ciphertext", () => {
			const secret = "test-secret";

			expect(() => decrypt("not:valid:ciphertext", secret)).toThrow();
			expect(() => decrypt("", secret)).toThrow();
		});
	});
});
