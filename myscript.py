from aleph_client.asynchronous import create_store
from aleph_client.chains.ethereum import ETHAccount
import asyncio
import os, shutil
import sys

async def aleph_ipfs():
    private_key = sys.argv[1]
    account = ETHAccount(private_key)

    path = './uploads'
    file = open(rf'./uploads/{os.listdir(path)[0]}', "rb").read()

    result = await create_store(file_content=file, account=account, storage_engine="ipfs")

    print(  f'https://ipfs.io/ipfs/{result.content.item_hash}' )
    shutil.rmtree('./uploads')
    os.makedirs('./uploads')

 

asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
asyncio.run(aleph_ipfs())