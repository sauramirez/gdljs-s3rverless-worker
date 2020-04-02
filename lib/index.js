'use strict';

const AWS = require('aws-sdk');
const Delay = require('delay');
const PForever = require('p-forever');
const { default: PQueue } = require('p-queue');
const Keys = require('./keys');
const Path = require('path');

const internals = {};

internals.contentTypes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'application/javascript',
];

internals.queue = new PQueue({
  concurrency: 4
});

internals.s3 = new AWS.S3(Keys);

internals.evaluateFile = async function(s3file) {
  console.log(s3file);
  const today = new Date();
  let type = '1';
  const meta = await internals.s3.headObject({
    Bucket: 'demo-simplebytes-dev',
    Key: s3file.Key
  }).promise();
  console.log('meta', meta);
  const contentType = meta.ContentType.split(';')[0];
  const deleteParams = {
    Bucket: 'demo-simplebytes-dev',
    Key: s3file.Key
  };
  if (internals.contentTypes.indexOf(contentType) === -1 || s3file.Size >= 50000000) {
    // delete image
    return await internals.s3.deleteObject(deleteParams).promise();
  }
  const ext = Path.extname(s3file.Key);
  if (ext === '.json') {
    type = 0;
  }
  const params = {
    Bucket: 'demo-simplebytes-dev',
    CopySource: '/demo-simplebytes-dev/' + s3file.Key,
    Key: `outputs/${today.getTime()}_${type}_${Path.basename(s3file.Key)}`
  };
  try {
  await internals.s3.copyObject(params).promise();
  }
  catch (error) {
    console.error(error);
    throw new Error('nan');
  }
  await internals.s3.deleteObject(deleteParams).promise();
};

internals.checkForJobs = async function () {

  const params = {
    Bucket: 'demo-simplebytes-dev',
    MaxKeys: 200,
    Prefix: 'inputs',
  };
  try {
    const list = await internals.s3.listObjectsV2(params).promise();
    for (const s3file of list.Contents) {
      internals.queue.add(internals.evaluateFile.bind(this, s3file));
      //async () => {
        //internals.evaluateFile(s3File, {
        //});
      //});
    }
    //console.log(list);
  }
  catch (error) {
    console.error(error);
  }
};

internals.main = async function () {

  await PForever(async () => {
    console.log('hi, how are you');
    await internals.checkForJobs();
    internals.queue.add(() => {
      console.log('fine');
    });
    await internals.queue.onIdle();
    await Delay(1000);
  });
}

if (require.main === module) {
  internals.main()
  .then(() => {
  })
  .catch(() => {
  });
}
