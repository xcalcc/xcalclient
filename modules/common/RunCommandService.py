import logging
import os
import subprocess
import tempfile


logger = logging.getLogger(__name__)


class ExecuteCommandService(object):

    @staticmethod
    def execute_command(command: str, logfile: str = None, environment: dict = None):
        """
        Invoke the shell/command line utility to execute command,
                    which may need proper privileges
        :param command:  command line to execute, please consider Windows / Linux capabilities
        :param logfile:  file name to the log file of the process, may be a tempfile.NamedTemporaryFile or
                         any file name with write privilege
        :param environment: environment variables to pass down.
        :return: (int) the return code from the subprocess.
        """
        logger.info("begin to run command: %s" % command)

        if environment is None:
            environment = dict(os.environ)

        tempfile_used = False
        if logfile is None:
            local_temp_file = tempfile.NamedTemporaryFile(mode="w+b")
            logfile = local_temp_file.name
            tempfile_used = True

        logger.info("dump to file: %s" % logfile)

        # Invoking Process --------------------------
        with open(logfile, "a+b") as out_f:
            out_f.write("\n---- execution command ------ \n".encode("UTF-8"))
            out_f.write(str(command).encode("UTF-8"))
            out_f.write(("\n----- saving dump to file -----\n" + logfile).encode("UTF-8"))
            out_f.write("\n----- environment: -----\n".encode("UTF-8"))
            out_f.write(str(environment).encode("UTF-8"))
            out_f.write("\n-------------------\n".encode("UTF-8"))
            out_f.flush()

            ret = subprocess.run(command, shell = True, env = environment, encoding="utf8", errors="ignore")

            rc = ret.returncode
            out_f.write("\n-------------------\n".encode("UTF-8"))
            out_f.write(("command return code: %s\n" % rc).encode("UTF-8"))

        if tempfile_used:
            local_temp_file.close()

        logger.debug("command return code: %s" % rc)
        return rc
