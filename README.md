# AWS-S3 前端上传封装

```js
  import AWSClient from "aws-client"
  const aWSClient = new AWSClient({
    accessKeyId: "your accessKeyId",
    secretAccessKey: "your secretAccessKey",
    endpoint: "your endpoint",
    Bucket: "your Bucket"
  })
  // 分片上传
  const result = await awsClient.multipartUpload({
    file,
    progress: (percent) => {
      this.percentage = percent * 100;
    },
    breakpoint: () => {
      return new Promise((res, rej) => {
        this.$confirm('是否继续上传', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }).then(() => {
          res(true)
        }).catch(() => {  
          res(false)
        });
      })
    }
  })
  // 普通上传
  const result = await awsClient.upload({ file })

```