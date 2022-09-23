import base64
import hashlib
import sys

from Crypto.Cipher import AES
from Crypto import Random
BLOCK_SIZE = 32 # cbc 256
pad = lambda s: s + (BLOCK_SIZE - len(s) % BLOCK_SIZE) * chr(BLOCK_SIZE - len(s) % BLOCK_SIZE)
unpad = lambda s: s[:-ord(s[len(s) - 1:])]
def encrypt(plain_text, key):
    private_key = hashlib.sha256(key.encode("utf-8")).digest()
    plain_text = pad(plain_text)
    print("After padding:", plain_text)
    iv = Random.new().read(AES.block_size)
    cipher = AES.new(private_key, AES.MODE_CBC, iv)
    return base64.b64encode(iv + cipher.encrypt(plain_text))

def decrypt(cipher_text, key, iv):
    try:
        cipher_text_bs = bytes.fromhex(cipher_text)
        cipher = AES.new(key, AES.MODE_CBC, iv)
        decrypted = cipher.decrypt(cipher_text_bs)

        return unpad(decrypted).decode('utf-8')
    except Exception as e:
        print(e)

