#
#  Copyright (C) 2021 Xcalibyte (Shenzhen) Limited.
#
import logging
import os
import subprocess
import tempfile
import time

from common.CommonGlobals import TaskErrorNo
from common.XcalException import XcalException

logger = logging.getLogger(__name__)

class ExecuteCommandService(object):

    @staticmethod
    def execute_command(command: str, logfile: str = None, environment: dict = None,
                        need_display: bool = False):
        """
        Invoke the shell/command line utility to execute command,
                    which may need proper privileges
        :param command:  command line to execute, please consider Windows / Linux capabilities
        :param logfile:  file name to the log file of the process, may be a tempfile.NamedTemporaryFile or
                         any file name with write privilege
        :param environment: environment variables to pass down.
        :param need_display: whether to display the output of the subprocess to logs/screen
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

            process = subprocess.Popen(command, shell = True, universal_newlines = True, stdout = subprocess.PIPE,
                                       stderr = subprocess.STDOUT,
                                       env = environment,
                                       encoding="utf8", errors="ignore")

            while True:
                line = process.stdout.readline()
                if line == '' and process.poll() is not None:
                    break
                if need_display and line:
                    logger.debug("[output]", line.strip())

                #ExecuteCommandService._check_timeout(endtime, timeout)

            rc = process.poll()
            out_f.write("\n-------------------\n".encode("UTF-8"))
            out_f.write(("command return code: %s\n" % rc).encode("UTF-8"))

        if tempfile_used:
            local_temp_file.close()

        logger.debug("command return code: %s" % rc)
        return rc

    @staticmethod
    def _check_timeout(endtime, orig_timeout):
        """Convenience for checking if a timeout has expired."""
        if endtime is None:
            return
        if time.monotonic() > endtime:
            raise XcalException("ExecuteCommandService", "_check_timeout", "timeout: %s" % orig_timeout,
                                TaskErrorNo.E_COMMON_TIMEOUT)
