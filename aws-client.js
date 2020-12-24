const S3 = require('aws-sdk/clients/s3');
const SIZE = 5 * 1024 * 1024;
const AWS_UPLOAD_CACHE = 'AWS_UPLOAD_CACHE';
const randomString = (len) => {
    len = len || 32;
    let chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';
    let maxPos = chars.length;
    let pwd = '';
    for (let i = 0; i < len; i++) {
        pwd += chars.charAt(Math.floor(Math.random() * maxPos));
    }
    return pwd;
}
const getFileSuffix = (filename) => {
    let pos = filename.lastIndexOf('.')
    let suffix = ''
    if (pos != -1) {
        suffix = filename.substring(pos)
    }
    return suffix;
}
const setFileSuffix = (filename) => {
    return randomString(10) + getFileSuffix(filename)
}
const saveUpLoadStatus = ({ key, value }) => {
    const uploadStatusAll = getUploadStatusAll();
    uploadStatusAll[key] = value;
    window.localStorage.setItem(AWS_UPLOAD_CACHE, JSON.stringify(uploadStatusAll));
}
const delUpLoadStatus = (key) => {
    const uploadStatusAll = getUploadStatusAll();
    delete uploadStatusAll[key]
    window.localStorage.setItem(AWS_UPLOAD_CACHE, JSON.stringify(uploadStatusAll));
}
const getUploadStatusAll = () => {
    try {
        return JSON.parse(window.localStorage.getItem(AWS_UPLOAD_CACHE) || '{}')
    } catch (e) {
        return {};
    }
}
const getUploadStatus = (key) => {
    const uploadStatusAll = getUploadStatusAll();
    return uploadStatusAll[key] || false
}
class AWSClient {
    constructor(options) {
        this.options = options;
        this.client = null;
        this.Bucket = options.Bucket;
        this.initClient(options);
    }
    initClient({ accessKeyId, secretAccessKey, endpoint, signatureVersion, apiVersion, s3ForcePathStyle }) {
        this.client = new S3({
            accessKeyId,
            secretAccessKey,
            endpoint,
            signatureVersion: signatureVersion || 'v2',
            apiVersion: apiVersion || '2006-03-01',
            s3ForcePathStyle: s3ForcePathStyle || true
        });
    }
    createMultipartUpload({ Key }) {
        return new Promise((resolve, reject) => {
            this.client.createMultipartUpload({
                Bucket: this.Bucket,
                Key
            }, (err, data) => {
                if (err) return reject(err);
                resolve(data);
            })
        })
    }
    createFileChunk(file, size = SIZE) {
        const chunks = [];
        let cur = 0;
        while (cur < file.size) {
            chunks.push(file.slice(cur, cur + size));
            cur += size;
        }
        return chunks;
    }
    async sendRequest({ Body, PartNumber, Key, UploadId, progress, chunks, file, MultipartUpload = { Parts: [] } }) {
        try {
            await this.uploadPart({ Body, PartNumber, Key, UploadId, progress, chunks, MultipartUpload, file });
            return await this.completeMultipartUpload({ Key, UploadId, progress, MultipartUpload, file });
        } catch (e) {
            progress(0);
            await this.abortMultipartUpload({ Key, UploadId })
        }
    }
    abortMultipartUpload({ Key, UploadId }) {
        return new Promise((resolve, reject) => {
            this.client.abortMultipartUpload({
                Bucket: this.Bucket,
                Key,
                UploadId
            }, (err, data) => {
                if (err) return reject(err);
                resolve(data);
            });
        })
    }
    async uploadPart({ Body, PartNumber, Key, UploadId, progress, chunks, MultipartUpload, file }) {
        return new Promise((resolve, reject) => {
            this.client.uploadPart({
                Body,
                Bucket: this.Bucket,
                Key,
                PartNumber,
                UploadId
            }, async (err, data) => {
                if (err) return reject(err);
                MultipartUpload.Parts.push({
                    ETag: data.ETag,
                    PartNumber
                })
                if (chunks[PartNumber]) {
                    try {
                        progress(PartNumber / chunks.length)
                        // 断点续传保存上传状态
                        saveUpLoadStatus({
                            key: file.name,
                            value: {
                                PartNumber: PartNumber + 1,
                                Key,
                                UploadId,
                                MultipartUpload
                            }
                        })
                        await this.uploadPart({
                            Body: chunks[PartNumber],
                            PartNumber: PartNumber + 1,
                            Key,
                            UploadId,
                            progress,
                            chunks,
                            MultipartUpload,
                            file
                        })
                    } catch (e) { console.error(e) }
                }
                resolve(data);
            })
        })
    }
    async completeMultipartUpload({ Key, UploadId, progress, MultipartUpload, file }) {
        return new Promise((resolve, reject) => {
            this.client.completeMultipartUpload({
                Bucket: this.Bucket,
                Key,
                UploadId,
                MultipartUpload
            }, (err, data) => {
                if (err) return reject(err);
                progress(1);
                delUpLoadStatus(file.name)
                resolve(data);
            })
        })
    }
    async putObject({ Key }) {
        return new Promise((resolve, reject) => {
            this.client.putObject({
                Bucket: this.Bucket,
                Key
            }, (err) => {
                if (err) return reject(err);
                resolve({
                    url: `${this.options.endpoint}/${this.Bucket}/${Key}`
                });
            })
        })
    }
    // 分片上传
    async multipartUpload({ file, size, progress, breakpoint }) {
        const chunks = this.createFileChunk(file, size);
        const uploadStatus = getUploadStatus(file.name);
        let useCache = false;
        if (breakpoint && uploadStatus) {
            useCache = await breakpoint(uploadStatus)
        }
        if (uploadStatus && useCache) {
            // 断点续传
            const { Key, MultipartUpload, PartNumber, UploadId } = uploadStatus;
            return await this.sendRequest({ Body: chunks[PartNumber - 1], PartNumber, Key, UploadId, progress, chunks, file, MultipartUpload });
        } else {
            const Key = setFileSuffix(file.name);
            const { UploadId } = await this.createMultipartUpload({ Key });
            return await this.sendRequest({ Body: chunks[0], PartNumber: 1, Key, UploadId, progress, chunks, file });
        }
    }
    // 普通上传
    async upload({ file }) {
        const Key = setFileSuffix(file.name);
        return await this.putObject({ Key });
    }
    // 处理跨域
    putBucketCors(CORSConfiguration) {
        this.client.putBucketCors({
            Bucket: this.Bucket,
            CORSConfiguration: CORSConfiguration || {
                CORSRules: [
                    {
                        AllowedHeaders: ["*"],
                        AllowedMethods: ["PUT", "POST", "DELETE", "GET"],
                        AllowedOrigins: ["*"],
                        ExposeHeaders: ["*"],
                        MaxAgeSeconds: 3000
                    }
                ]
            },
            ContentMD5: ""
        })
    }
}

export default AWSClient;