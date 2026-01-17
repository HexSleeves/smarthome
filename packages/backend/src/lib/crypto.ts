import {
	createCipheriv,
	createDecipheriv,
	randomBytes,
	scryptSync,
} from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;

function getKey(secret: string, salt: Buffer): Buffer {
	return scryptSync(secret, salt, KEY_LENGTH);
}

export function encrypt(plaintext: string, secret: string): string {
	const salt = randomBytes(SALT_LENGTH);
	const key = getKey(secret, salt);
	const iv = randomBytes(IV_LENGTH);

	const cipher = createCipheriv(ALGORITHM, key, iv);
	const encrypted = Buffer.concat([
		cipher.update(plaintext, "utf8"),
		cipher.final(),
	]);
	const tag = cipher.getAuthTag();

	// Format: salt:iv:tag:encrypted (all base64)
	return [
		salt.toString("base64"),
		iv.toString("base64"),
		tag.toString("base64"),
		encrypted.toString("base64"),
	].join(":");
}

export function decrypt(ciphertext: string, secret: string): string {
	const [saltB64, ivB64, tagB64, encryptedB64] = ciphertext.split(":");

	const salt = Buffer.from(saltB64, "base64");
	const iv = Buffer.from(ivB64, "base64");
	const tag = Buffer.from(tagB64, "base64");
	const encrypted = Buffer.from(encryptedB64, "base64");

	const key = getKey(secret, salt);
	const decipher = createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(tag);

	return decipher.update(encrypted) + decipher.final("utf8");
}
