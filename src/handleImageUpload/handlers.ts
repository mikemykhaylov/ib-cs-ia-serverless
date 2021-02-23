const handleImageUpload = async (event: AWSLambda.S3Event) => {
  console.log(JSON.stringify(event.Records[0]));
};

export { handleImageUpload };
