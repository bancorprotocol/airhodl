module.exports = function(fs) {
    const openSync = fs.openSync;
    fs.openSync = function(path, flags, mode) {
        const logged = {};
        while (true) {
            try {
                return openSync(path, flags, mode);
            }
            catch (error) {
                if (logged[error.message] == undefined) {
                    logged[error.message] = true;
                    console.log(error.message);
                }
            }
        }
    };
};
