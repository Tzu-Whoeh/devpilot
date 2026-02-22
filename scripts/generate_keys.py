#!/usr/bin/env python3
"""Generate RSA key pair for DevPilot JWT signing (RS256).

Usage:
    python3 scripts/generate_keys.py [output_dir]

Outputs:
    {output_dir}/jwt_private.pem   — Auth Service (keep secret)
    {output_dir}/jwt_public.pem    — AI Gateway (safe to distribute)
"""

import sys
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa


def generate_rsa_keypair(output_dir: str = ".") -> tuple[Path, Path]:
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    priv_path = out / "jwt_private.pem"
    pub_path = out / "jwt_public.pem"

    priv_path.write_bytes(
        private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )
    priv_path.chmod(0o600)

    pub_path.write_bytes(
        private_key.public_key().public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
    )

    print(f"Private key: {priv_path.resolve()}")
    print(f"Public key:  {pub_path.resolve()}")
    return priv_path, pub_path


if __name__ == "__main__":
    output = sys.argv[1] if len(sys.argv) > 1 else "."
    generate_rsa_keypair(output)
