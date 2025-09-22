import bcrypt from 'bcrypt';
import 'dotenv/config';

export const hashPass = (password) => {
    // Ensure saltRounds is a valid number between 4 and 15
    let saltRounds = parseInt(process.env.HASHPASSWORD);
    
    if (isNaN(saltRounds) || saltRounds < 4 || saltRounds > 15) {
        saltRounds = 10;
    }
    
    return bcrypt.hashSync(password, saltRounds);
}

export const comparePass = (password, hashedPassword) => {
    try {
        return bcrypt.compareSync(password, hashedPassword);
    } catch (error) {
        console.error('Error comparing passwords:', error);
        return false;
    }
}