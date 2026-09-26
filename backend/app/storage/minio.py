from __future__ import annotations

from dataclasses import dataclass, field
from io import BytesIO

import boto3
from botocore.exceptions import ClientError
from botocore.client import BaseClient


@dataclass(slots=True)
class MinioStorage:
    endpoint: str
    access_key: str
    secret_key: str
    bucket: str
    use_ssl: bool = False
    _client: BaseClient = field(init=False, repr=False)

    def __post_init__(self) -> None:
        self._client = boto3.client(
            "s3",
            endpoint_url=f"{'https' if self.use_ssl else 'http'}://{self.endpoint}",
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            region_name="us-east-1",
        )

    def ensure_bucket(self) -> None:
        existing = {bucket["Name"] for bucket in self._client.list_buckets().get("Buckets", [])}
        if self.bucket not in existing:
            self._client.create_bucket(Bucket=self.bucket)

    def upload_bytes(self, *, object_name: str, content: bytes, content_type: str) -> str:
        self.ensure_bucket()
        self._client.put_object(
            Bucket=self.bucket,
            Key=object_name,
            Body=BytesIO(content),
            ContentType=content_type,
            ContentLength=len(content),
        )
        return object_name

    def download_bytes(self, object_name: str) -> bytes:
        response = self._client.get_object(Bucket=self.bucket, Key=object_name)
        return response["Body"].read()

    def generate_presigned_url(self, object_name: str, expires_in: int = 3600) -> str:
        # AWS S3 compatible presigned URL
        return self._client.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": self.bucket, "Key": object_name},
            ExpiresIn=expires_in,
        )

    def delete_object(self, object_name: str) -> None:
        try:
            self._client.delete_object(Bucket=self.bucket, Key=object_name)
        except ClientError as error:
            code = error.response.get("Error", {}).get("Code")
            if code not in {"NoSuchKey", "NoSuchBucket"}:
                raise
