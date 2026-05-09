import {v2 as cloudinary} from 'cloudinary';
import fs from "fs";
import dotenv from "dotenv";

dotenv.config({
    path: "./.env"
});


cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});
const uploadOnCloudinary = async(localFilePath) =>{
    try{
        if(!localFilePath) return null
        const response = await cloudinary.uploader.upload(localFilePath,{
            resource_type:"auto"
        })
        console.log('file is uploaded on lodinary',response.url)
        return response;
    }catch(error){
        console.log("Cloudinary Error:", error);

        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }
        // fs.unlinkSync(localFilePath)//remove localy save temp file 
        return null;

    }
};

// utils/cloudinary.js — add this alongside uploadOnCloudinary
export const deleteFromCloudinary = async (imageUrl) => {
    if (!imageUrl) return;
    try {
        // Extract the public_id from the URL
        // Cloudinary URLs look like: .../upload/v123456/public_id.ext
        const publicId = imageUrl.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(publicId);
    } catch (error) {
        console.error("Error deleting from Cloudinary:", error);
    }
};
export { uploadOnCloudinary,deleteFromCloudinary};