# AWS-S3 前端上传封装

### 下载依赖
```
npm i @fly_tiger/aws-client
```

### 在项目中引入aws-client依赖

```js
import AWSClient from "aws-client"
```

### 初始化AWSClient实例

传入accessKeyId，secretAccessKey，endpoint，Bucket四个参数，参数可以通过接口获得：/base/sysStorageCeph/anon/getCephSignature

```js
  const aWSClient = new AWSClient({
    accessKeyId: "your accessKeyId",
    secretAccessKey: "your secretAccessKey",
    endpoint: "your endpoint",
    Bucket: "your Bucket"
  })

```

### 普通上传
```js
const result = await awsClient.upload({ file })
/*
   result = {
    url: "https://examplebucket.s3.<Region>.amazonaws.com/bigobject"
   }
*/
```

### 分片上传
```js
  const multipartUploadClient = await awsClient.multipartUpload({
    file, // 传入文件对象
    progress: (percent) => {
      this.percentage = percent * 100; 
    }, // 上传进度回调，参数是上传的进度
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
    } // 断点续传，返回一个Promise，reslove(true)：继续上一次的上传，reslove(false)：放弃上一次上传，开始新的上传
  });
  multipartUploadClient.run(); // 开始分片上传
  multipartUploadClient.pause(); // 暂停分片上传
  multipartUploadClient.reRun(); // 重新开始分片上传
```

### Bucket跨域处理

首次在前端使用aws的方法可能存在浏览器跨域的问题。此时可以调用awsClient.putBucketCors动态更改Bucket的跨域配置(对于每个新建的Bucket一般只需要调用一次)。

```js
awsClient.multipartUpload();
```

### 其他方法调用
请参考AWS.S3官方文档<a href="https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html">https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html</a>

示例：

```js
const aWSClient = new AWSClient({
    accessKeyId: "your accessKeyId",
    secretAccessKey: "your secretAccessKey",
    endpoint: "your endpoint",
    Bucket: "your Bucket"
})

// 获取所有的Bucket;
const params = {};
aWSClient.client.listBuckets(params, function(err, data) {
   if (err) console.log(err, err.stack); // an error occurred
   else     console.log(data);           // successful response
   /*
   data = {
    Buckets: [
       {
      CreationDate: <Date Representation>, 
      Name: "examplebucket"
     }, 
       {
      CreationDate: <Date Representation>, 
      Name: "examplebucket2"
     }, 
       {
      CreationDate: <Date Representation>, 
      Name: "examplebucket3"
     }
    ], 
    Owner: {
     DisplayName: "own-display-name", 
     ID: "examplee7a2f25102679df27bb0ae12b3f85be6f290b936c4393484be31"
    }
   }
   */
});

// 获取存储的对象
var params = {
    Bucket: "examplebucket", 
    MaxKeys: 2
};
aWSClient.client.listObjects(params, function(err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else     console.log(data);           // successful response
    /*
    data = {
    Contents: [
       {
      ETag: "\"70ee1738b6b21e2c8a43f3a5ab0eee71\"", 
      Key: "example1.jpg", 
      LastModified: <Date Representation>, 
      Owner: {
       DisplayName: "myname", 
       ID: "12345example25102679df27bb0ae12b3f85be6f290b936c4393484be31bebcc"
      }, 
      Size: 11, 
      StorageClass: "STANDARD"
     }, 
       {
      ETag: "\"9c8af9a76df052144598c115ef33e511\"", 
      Key: "example2.jpg", 
      LastModified: <Date Representation>, 
      Owner: {
       DisplayName: "myname", 
       ID: "12345example25102679df27bb0ae12b3f85be6f290b936c4393484be31bebcc"
      }, 
      Size: 713193, 
      StorageClass: "STANDARD"
     }
    ], 
    NextMarker: "eyJNYXJrZXIiOiBudWxsLCAiYm90b190cnVuY2F0ZV9hbW91bnQiOiAyfQ=="
   }
   */
});

```

其他方法请参考AWS.S3官方文档<a href="https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html">https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html</a>

